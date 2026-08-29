import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getAdminClient, extractJwt, requireRole } from "../_shared/supabase.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const liveSessionSchema = z.object({ sesi_id: z.string().uuid("Invalid session ID") });

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response(JSON.stringify({ error: "Missing Authorization header" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const adminClient = getAdminClient();
  const jwt = extractJwt(authHeader);

  try {
    const roleCheck = await requireRole(adminClient, jwt, ["admin", "super_admin", "admin_prodi", "dosen"]);
    if (roleCheck instanceof Response) return roleCheck;
    const { user, profile } = roleCheck;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const parsed = liveSessionSchema.safeParse(body);
    if (!parsed.success) return new Response(JSON.stringify({ error: parsed.error.errors[0].message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { sesi_id } = parsed.data;

    const { data: session } = await adminClient.from("sesi_kehadiran").select("sesi_id, status, waktu_mulai, geofence_radius_m, qr_rotates_every, jadwal_id, jadwal_kelas!inner(dosen_id)").eq("sesi_id", sesi_id).maybeSingle();
    if (!session) return new Response(JSON.stringify({ error: "Session not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Ownership check for dosen
    if (profile.role === "dosen") {
      const { data: dosenProfile } = await adminClient
        .from("dosen")
        .select("dosen_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!dosenProfile || session.jadwal_kelas?.dosen_id !== dosenProfile.dosen_id) {
        return new Response(JSON.stringify({ error: "Access denied" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const { count: present } = await adminClient.from("presensi").select("presensi_id", { count: "exact", head: true }).eq("sesi_id", sesi_id).in("status", ["present", "late", "excused"]);
    
    const { count: total_students } = await adminClient.from("pendaftaran_kelas").select("pendaftaran_id", { count: "exact", head: true }).eq("jadwal_id", session.jadwal_id);
    const absent = Math.max(0, (total_students || 0) - (present || 0));

    const { data: recentCheckins } = await adminClient.from("presensi").select("presensi_id, waktu_check_in, status, mahasiswa_id, mahasiswa!inner(nim, nama)").eq("sesi_id", sesi_id).order("waktu_check_in", { ascending: false }).limit(20);

    return new Response(JSON.stringify({
      sesi_id: session.sesi_id, status: session.status, waktu_mulai: session.waktu_mulai,
      geofence_radius_m: session.geofence_radius_m, qr_rotates_every: session.qr_rotates_every,
      counts: { present: present || 0, absent: absent },
      recent_checkins: recentCheckins || [],
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
