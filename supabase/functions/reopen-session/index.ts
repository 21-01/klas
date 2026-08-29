import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getAdminClient, extractJwt, getClientIp } from "../_shared/supabase.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const reopenSessionSchema = z.object({
  sesi_id: z.string().uuid("Invalid session ID"),
  tanggal: z.string().optional(),
  geofence_radius_m: z.number().int().min(10).max(500).optional(),
  qr_rotates_every: z.number().int().min(5).max(60).optional(),
});

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response(JSON.stringify({ error: "Missing Authorization header" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const adminClient = getAdminClient();
  const jwt = extractJwt(authHeader);
  const clientIp = getClientIp(req);

  try {
    const { data: { user }, error: userError } = await adminClient.auth.getUser(jwt);
    if (userError || !user) return new Response(JSON.stringify({ error: "Invalid user token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: userProfile } = await adminClient.from("users").select("role").eq("user_id", user.id).maybeSingle();
    const isAdmin = ["admin", "super_admin", "admin_prodi"].includes(userProfile?.role);

    let dosenId: string | null = null;
    if (!isAdmin) {
      const { data: dosen } = await adminClient.from("dosen").select("dosen_id").eq("user_id", user.id).maybeSingle();
      if (!dosen) return new Response(JSON.stringify({ error: "Dosen profile not found" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      dosenId = dosen.dosen_id;
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const parsed = reopenSessionSchema.safeParse(body);
    if (!parsed.success) return new Response(JSON.stringify({ error: parsed.error.errors[0].message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { sesi_id, tanggal, geofence_radius_m, qr_rotates_every } = parsed.data;

    const { data: session } = await adminClient.from("sesi_kehadiran").select("sesi_id, jadwal_id, status, jadwal_kelas!inner(dosen_id)").eq("sesi_id", sesi_id).maybeSingle();
    if (!session) return new Response(JSON.stringify({ error: "Session not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!isAdmin && session.jadwal_kelas?.dosen_id !== dosenId) return new Response(JSON.stringify({ error: "You are not the lecturer for this session" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (session.status !== "completed") return new Response(JSON.stringify({ error: "Only completed sessions can be reopened" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: existingLive } = await adminClient.from("sesi_kehadiran").select("sesi_id").eq("jadwal_id", session.jadwal_id).eq("status", "live").maybeSingle();
    if (existingLive) {
      return new Response(JSON.stringify({ error: "A live session is already active for this class" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const qr_seed = crypto.getRandomValues(new Uint8Array(8)).reduce((a, b) => a + b, 0);

    const updatePayload: any = {
      status: "live",
      waktu_selesai: null,
      waktu_mulai: new Date().toISOString(),
      qr_seed,
    };
    if (tanggal) updatePayload.tanggal = tanggal;
    if (geofence_radius_m !== undefined) updatePayload.geofence_radius_m = geofence_radius_m;
    if (qr_rotates_every !== undefined) updatePayload.qr_rotates_every = qr_rotates_every;

    const { error: updateError } = await adminClient.from("sesi_kehadiran").update(updatePayload).eq("sesi_id", sesi_id);
    if (updateError) throw updateError;

    await adminClient.from("audit_log").insert({
      kategori: "Attendance Overrides", aksi: `Session ${sesi_id} reopened by ${isAdmin ? "admin" : "dosen " + dosenId}`,
      ip_address: clientIp, user_id: user.id, status: "success",
    });

    return new Response(JSON.stringify({ sesi_id, status: "live" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
