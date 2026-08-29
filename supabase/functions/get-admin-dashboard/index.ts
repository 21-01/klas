import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getAdminClient, extractJwt } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const authHeader = req.headers.get("Authorization");

  const adminClient = getAdminClient();
  const jwt = extractJwt(authHeader);
  if (!jwt) {
    return new Response(JSON.stringify({ error: "Missing or invalid Authorization header" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > 0) {
      try {
        await req.json();
      } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { data: { user }, error: userError } = await adminClient.auth.getUser(jwt);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid user token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await adminClient
      .from("users")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile || profile.role !== "admin") {
      return new Response(JSON.stringify({ error: "Access denied: Admin role required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const jakartaTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const today = jakartaTime.toISOString().split("T")[0];

    const [
      { count: totalStudents },
      { count: totalLecturers },
      { count: totalCourses },
      { count: totalRooms },
      { count: activeSessionsToday },
      { count: completedSessionsToday },
      { count: totalSessions },
      { count: totalEnrollments },
      { count: geofenceViolations },
      { data: allPresensi },
    ] = await Promise.all([
      adminClient.from("mahasiswa").select("mahasiswa_id", { count: "exact", head: true }).eq("is_active", true),
      adminClient.from("dosen").select("dosen_id", { count: "exact", head: true }).eq("is_active", true),
      adminClient.from("mata_kuliah").select("kode_mk", { count: "exact", head: true }).eq("is_active", true),
      adminClient.from("ruangan").select("ruangan_id", { count: "exact", head: true }).eq("is_active", true),
      adminClient.from("sesi_kehadiran").select("sesi_id", { count: "exact", head: true }).eq("status", "live").eq("tanggal", today),
      adminClient.from("sesi_kehadiran").select("sesi_id", { count: "exact", head: true }).eq("status", "completed").eq("tanggal", today),
      adminClient.from("sesi_kehadiran").select("sesi_id", { count: "exact", head: true }),
      adminClient.from("pendaftaran_kelas").select("pendaftaran_id", { count: "exact", head: true }),
      adminClient.from("presensi").select("presensi_id", { count: "exact", head: true }).eq("geofence_flagged", true),
      adminClient.from("presensi").select("mahasiswa_id, status"),
    ]);

    const totalPresensiAll = allPresensi?.length || 0;
    const presentOrLate = (allPresensi || []).filter(
      (p: any) => p.status === "present" || p.status === "late" || p.status === "excused",
    ).length;
    const attendanceRate = totalPresensiAll > 0
      ? Math.round((presentOrLate / totalPresensiAll) * 10000) / 100
      : 0;

    const attendanceByStudent = new Map<string, { total: number; present: number }>();
    for (const p of allPresensi || []) {
      const r = p as any;
      if (!attendanceByStudent.has(r.mahasiswa_id)) {
        attendanceByStudent.set(r.mahasiswa_id, { total: 0, present: 0 });
      }
      const entry = attendanceByStudent.get(r.mahasiswa_id)!;
      entry.total++;
      if (r.status === "present" || r.status === "late" || r.status === "excused") {
        entry.present++;
      }
    }
    let lowAttendanceCount = 0;
    for (const [, stats] of attendanceByStudent) {
      if (stats.total > 0 && stats.present / stats.total < 0.75) {
        lowAttendanceCount++;
      }
    }

    const trendDays: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(jakartaTime.getTime());
      d.setUTCDate(d.getUTCDate() - i);
      trendDays.push(d.toISOString().split("T")[0]);
    }

    const trend = await Promise.all(
      trendDays.map(async (date) => {
        const { data: records } = await adminClient
          .from("presensi")
          .select("status")
          .eq("sesi_kehadiran.tanggal", date);

        const presentCount = (records || []).filter(
          (r: any) => r.status === "present" || r.status === "late" || r.status === "excused",
        ).length;
        const absentCount = (records || []).filter(
          (r: any) => r.status === "absent",
        ).length;

        return { date, present_count: presentCount, absent_count: absentCount };
      }),
    );

    return new Response(
      JSON.stringify({
        total_students: totalStudents || 0,
        total_lecturers: totalLecturers || 0,
        total_courses: totalCourses || 0,
        total_rooms: totalRooms || 0,
        active_sessions_today: activeSessionsToday || 0,
        completed_sessions_today: completedSessionsToday || 0,
        total_sessions_all_time: totalSessions || 0,
        total_enrollments: totalEnrollments || 0,
        overall_attendance_rate: attendanceRate,
        students_with_low_attendance: lowAttendanceCount,
        attendance_trend: trend,
        geofence_violations: geofenceViolations || 0,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
