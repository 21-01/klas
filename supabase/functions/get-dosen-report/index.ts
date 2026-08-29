import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getAdminClient, extractJwt, requireRole } from "../_shared/supabase.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const reportSchema = z.object({
  jadwal_id: z.string().uuid(),
});

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
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const parsed = reportSchema.safeParse(body);
    if (!parsed.success) return new Response(JSON.stringify({ error: parsed.error.errors[0].message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { jadwal_id } = parsed.data;

    // Ownership check for dosen
    if (profile.role === "dosen") {
      const { data: jadwal } = await adminClient
        .from("jadwal_kelas")
        .select("dosen_id")
        .eq("jadwal_id", jadwal_id)
        .maybeSingle();
      const { data: dosenProfile } = await adminClient
        .from("dosen")
        .select("dosen_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!jadwal || !dosenProfile || jadwal.dosen_id !== dosenProfile.dosen_id) {
        return new Response(JSON.stringify({ error: "Access denied" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Get course info
    const { data: jadwal } = await adminClient.from("jadwal_kelas").select(`
      jadwal_id, hari, waktu_mulai, waktu_selesai, semester, tahun_akademik, quota,
      mata_kuliah!inner(kode_mk, nama_mk, sks),
      ruangan!inner(nama_ruangan)
    `).eq("jadwal_id", jadwal_id).single();

    // Get all sessions for this jadwal
    const { data: sessions } = await adminClient.from("sesi_kehadiran").select("sesi_id, tanggal, status").eq("jadwal_id", jadwal_id).order("tanggal", { ascending: true });

    // Get all enrolled students with attendance stats
    const { data: enrollments } = await adminClient.from("pendaftaran_kelas").select(`
      mahasiswa_id, mahasiswa!inner(nim, nama, gpa)
    `).eq("jadwal_id", jadwal_id);

    const totalSessions = (sessions || []).length;
    const studentReports = await Promise.all((enrollments || []).map(async (e: any) => {
      const { data: attendance } = await adminClient.from("presensi").select("status").eq("mahasiswa_id", e.mahasiswa_id).in("sesi_id", (sessions || []).map((s: any) => s.sesi_id));
      const present = (attendance || []).filter((a: any) => a.status === "present" || a.status === "late").length;
      const absent = (attendance || []).filter((a: any) => a.status === "absent").length;
      const excused = (attendance || []).filter((a: any) => a.status === "excused").length;
      return {
        nim: e.mahasiswa.nim, nama: e.mahasiswa.nama, gpa: e.mahasiswa.gpa,
        attendance: { present, absent, excused, total: (attendance || []).length },
        rate: totalSessions > 0 ? Math.round((present / totalSessions) * 10000) / 100 : 0,
      };
    }));

    const totalPresent = studentReports.reduce((sum, s) => sum + s.attendance.present, 0);
    const totalPossible = studentReports.reduce((sum, s) => sum + s.attendance.total, 0);
    const overallRate = totalPossible > 0 ? Math.round((totalPresent / totalPossible) * 10000) / 100 : 0;

    return new Response(JSON.stringify({
      course: jadwal.mata_kuliah, schedule: { hari: jadwal.hari, waktu_mulai: jadwal.waktu_mulai, waktu_selesai: jadwal.waktu_selesai, semester: jadwal.semester, tahun_akademik: jadwal.tahun_akademik, ruangan: jadwal.ruangan?.nama_ruangan },
      total_sessions: totalSessions, total_students: studentReports.length,
      overall_attendance_rate: overallRate,
      students: studentReports,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
