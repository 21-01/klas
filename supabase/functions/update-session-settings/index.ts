import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getAdminClient, extractJwt, getClientIp } from "../_shared/supabase.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const updateSettingsSchema = z.object({ 
  sesi_id: z.string().uuid("Invalid session ID"),
  geofence_radius_m: z.number().int().min(10).max(500).optional(),
  qr_rotates_every: z.number().int().min(5).max(60).optional()
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

    const body = await req.json();
    const parsed = updateSettingsSchema.safeParse(body);
    if (!parsed.success) return new Response(JSON.stringify({ error: parsed.error.errors[0].message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { sesi_id, geofence_radius_m, qr_rotates_every } = parsed.data;

    const { data: session } = await adminClient.from("sesi_kehadiran").select("sesi_id, jadwal_id, status, jadwal_kelas!inner(dosen_id)").eq("sesi_id", sesi_id).maybeSingle();
    if (!session) return new Response(JSON.stringify({ error: "Session not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!isAdmin && session.jadwal_kelas?.dosen_id !== dosenId) return new Response(JSON.stringify({ error: "You are not the lecturer for this session" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const updatePayload: any = {};
    if (geofence_radius_m !== undefined) updatePayload.geofence_radius_m = geofence_radius_m;
    if (qr_rotates_every !== undefined) updatePayload.qr_rotates_every = qr_rotates_every;

    if (Object.keys(updatePayload).length > 0) {
      const { error: updateError } = await adminClient.from("sesi_kehadiran").update(updatePayload).eq("sesi_id", sesi_id);
      if (updateError) throw updateError;
    }

    await adminClient.from("audit_log").insert({
      kategori: "Attendance Overrides", aksi: `Session ${sesi_id} settings updated (radius: ${geofence_radius_m}, rot: ${qr_rotates_every}) by ${isAdmin ? "admin" : "dosen " + dosenId}`,
      ip_address: clientIp, user_id: user.id, status: "success",
    });

    return new Response(JSON.stringify({ message: "Settings updated successfully" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
