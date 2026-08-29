import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getAdminClient, extractJwt, getClientIp } from "../_shared/supabase.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const openSessionSchema = z.object({
  jadwal_id: z.string().uuid("Invalid jadwal ID"),
  tanggal: z.string().optional(),
  geofence_radius_m: z.number().int().min(1).max(500).optional(),
  qr_rotates_every: z.number().int().min(5).max(60).optional(),
});

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing Authorization header" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

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
    const parsed = openSessionSchema.safeParse(body);
    if (!parsed.success) return new Response(JSON.stringify({ error: parsed.error.errors[0].message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { jadwal_id, tanggal, geofence_radius_m, qr_rotates_every } = parsed.data;

    const { data: jadwal } = await adminClient.from("jadwal_kelas").select("dosen_id, ruangan_id, ruangan!inner(geofence_radius_m)").eq("jadwal_id", jadwal_id).maybeSingle();
    if (!jadwal) return new Response(JSON.stringify({ error: "Jadwal not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!isAdmin && jadwal.dosen_id !== dosenId) return new Response(JSON.stringify({ error: "You are not the lecturer for this class" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: existingLive } = await adminClient.from("sesi_kehadiran").select("sesi_id").eq("jadwal_id", jadwal_id).eq("status", "live").maybeSingle();
    if (existingLive) {
      return new Response(JSON.stringify({ error: "A live session is already active for this class" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const qr_seed = crypto.getRandomValues(new Uint8Array(8)).reduce((a, b) => a + b, 0);

    const { data: session, error: insertError } = await adminClient.from("sesi_kehadiran").insert({
      jadwal_id, tanggal: tanggal || new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().split("T")[0],
      waktu_mulai: new Date().toISOString(),
      qr_seed, qr_rotates_every: qr_rotates_every || 15,
      geofence_radius_m: geofence_radius_m || jadwal.ruangan?.geofence_radius_m || 50,
      status: "live", dibuka_oleh: dosenId,
    }).select().single();

    if (insertError) throw insertError;

    await adminClient.from("audit_log").insert({
      kategori: "Attendance Overrides", aksi: `Session opened for jadwal ${jadwal_id} by ${isAdmin ? "admin" : "dosen " + dosenId}`,
      ip_address: clientIp, user_id: user.id, status: "success",
    });

    return new Response(JSON.stringify({ sesi_id: session.sesi_id, status: "live", qr_seed: session.qr_seed }), { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
