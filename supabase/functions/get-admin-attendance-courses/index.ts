import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getAdminClient, extractJwt, requireRole } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response(JSON.stringify({ error: "Missing Authorization header" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const adminClient = getAdminClient();
  const jwt = extractJwt(authHeader);

  try {
    const roleCheck = await requireRole(adminClient, jwt, ["admin", "super_admin", "admin_prodi"]);
    if (roleCheck instanceof Response) return roleCheck;
    const { user, profile } = roleCheck;

    // Get admin's prodi_id
    const { data: adminUser } = await adminClient
      .from("users")
      .select("prodi_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const prodiId = adminUser?.prodi_id;

    // Build query - filter by prodi if admin_prodi, otherwise show all
    let query = adminClient
      .from("jadwal_kelas")
      .select(`
        jadwal_id, hari, waktu_mulai, waktu_selesai, semester, tahun_akademik, quota,
        mata_kuliah!inner(mk_id, kode_mk, nama_mk, sks),
        dosen!inner(dosen_id, nama)
      `);

    if (prodiId && profile.role === "admin_prodi") {
      // Filter jadwal by prodi via mata_kuliah.prodi_id
      query = query.eq("mata_kuliah.prodi_id", prodiId);
    }

    const { data: jadwalList, error: jadwalError } = await query;
    if (jadwalError) throw jadwalError;

    // Enrich with latest session and enrolled count
    const courses = await Promise.all((jadwalList || []).map(async (j: any) => {
      const { data: latestSession } = await adminClient
        .from("sesi_kehadiran")
        .select("sesi_id, status, tanggal, waktu_mulai")
        .eq("jadwal_id", j.jadwal_id)
        .order("waktu_mulai", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { count: enrolled } = await adminClient
        .from("pendaftaran_kelas")
        .select("pendaftaran_id", { count: "exact", head: true })
        .eq("jadwal_id", j.jadwal_id);

      return {
        jadwal_id: j.jadwal_id,
        mata_kuliah: j.mata_kuliah,
        dosen: j.dosen,
        hari: j.hari,
        waktu_mulai: j.waktu_mulai,
        waktu_selesai: j.waktu_selesai,
        semester: j.semester,
        ruangan: null,
        enrolled: enrolled || 0,
        latest_session: latestSession
          ? { sesi_id: latestSession.sesi_id, status: latestSession.status, tanggal: latestSession.tanggal }
          : null,
      };
    }));

    return new Response(JSON.stringify({ courses }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
