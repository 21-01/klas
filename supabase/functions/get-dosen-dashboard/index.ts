import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getAdminClient, getUserClient, extractJwt } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response(JSON.stringify({ error: "Missing Authorization header" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const adminClient = getAdminClient();
  const jwt = extractJwt(authHeader);

  try {
    const { data: { user }, error: userError } = await adminClient.auth.getUser(jwt);
    if (userError || !user) return new Response(JSON.stringify({ error: "Invalid user token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const userClient = getUserClient(jwt!);

    const { data: dosen } = await userClient.from("dosen").select("dosen_id, nama").eq("user_id", user.id).maybeSingle();
    if (!dosen) return new Response(JSON.stringify({ error: "Dosen profile not found" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Get all jadwal for this dosen
    const { data: jadwalList } = await userClient.from("jadwal_kelas").select(`
      jadwal_id, hari, waktu_mulai, waktu_selesai, semester, tahun_akademik, quota,
      mata_kuliah!inner(kode_mk, nama_mk, sks),
      ruangan!inner(nama_ruangan)
    `).eq("dosen_id", dosen.dosen_id);

    // Get all jadwal for this dosen
    const courses = await Promise.all((jadwalList || []).map(async (j: any) => {
      const { data: latestSession } = await userClient.from("sesi_kehadiran").select("sesi_id, status, tanggal, waktu_mulai")
        .eq("jadwal_id", j.jadwal_id).order("waktu_mulai", { ascending: false }).limit(1).maybeSingle();

      const { count: enrolled } = await userClient.from("pendaftaran_kelas").select("pendaftaran_id", { count: "exact", head: true }).eq("jadwal_id", j.jadwal_id);

      return {
        jadwal_id: j.jadwal_id, mata_kuliah: j.mata_kuliah, hari: j.hari,
        waktu_mulai: j.waktu_mulai, waktu_selesai: j.waktu_selesai,
        semester: j.semester, ruangan: j.ruangan?.nama_ruangan || null,
        enrolled: enrolled || 0,
        latest_session: latestSession ? { sesi_id: latestSession.sesi_id, status: latestSession.status, tanggal: latestSession.tanggal } : null,
      };
    }));

    return new Response(JSON.stringify({ dosen: { nama: dosen.nama }, courses }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
