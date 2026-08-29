import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getAdminClient, getUserClient, extractJwt } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const adminClient = getAdminClient();
  const jwt = extractJwt(authHeader);

  try {
    const { data: { user }, error: userError } = await adminClient.auth.getUser(jwt);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid user token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = getUserClient(jwt!);

    const { data: mhs } = await userClient
      .from("mahasiswa")
      .select("mahasiswa_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!mhs) {
      return new Response(JSON.stringify({ error: "Mahasiswa profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    // Convert to Asia/Jakarta (UTC+7)
    const jakartaTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const today = jakartaTime.toISOString().split("T")[0];
    const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const todayName = dayNames[jakartaTime.getUTCDay()];

    const { data: enrollments } = await userClient
      .from("pendaftaran_kelas")
      .select(`
        jadwal_id,
        jadwal_kelas!inner(
          jadwal_id, hari, waktu_mulai, waktu_selesai, semester, tahun_akademik, quota,
          mata_kuliah!inner(kode_mk, nama_mk, sks),
          ruangan!inner(nama_ruangan, latitude, longitude, geofence_radius_m)
        )
      `)
      .eq("mahasiswa_id", mhs.mahasiswa_id);

    // Get all enrolled jadwal IDs
    const allJadwalIds = (enrollments || []).map((e: any) => e.jadwal_id);

    // Fetch the latest session for each class (live or most recent)
    let sessions: any[] = [];
    if (allJadwalIds.length > 0) {
      const { data } = await userClient
        .from("sesi_kehadiran")
        .select("sesi_id, jadwal_id, status, waktu_mulai, qr_seed, tanggal")
        .in("jadwal_id", allJadwalIds)
        .order("waktu_mulai", { ascending: false });
      sessions = data || [];
    }

    // Pick the latest session per jadwal
    const sessionMap = new Map<string, any>();
    for (const s of sessions) {
      if (!sessionMap.has(s.jadwal_id)) {
        sessionMap.set(s.jadwal_id, s);
      }
    }

    const classes = (enrollments || []).map((e: any) => {
      const jk = e.jadwal_kelas;
      const sesi = sessionMap.get(e.jadwal_id);
      return {
        jadwal_id: jk.jadwal_id,
        mata_kuliah: jk.mata_kuliah,
        waktu_mulai: jk.waktu_mulai,
        waktu_selesai: jk.waktu_selesai,
        ruangan: jk.ruangan?.nama_ruangan || null,
        sesi_id: sesi?.sesi_id || null,
        sesi_status: sesi?.status || null,
      };
    });

    return new Response(
      JSON.stringify({ date: today, day: todayName, classes }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
