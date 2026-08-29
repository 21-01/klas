import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getAdminClient, extractJwt } from "../_shared/supabase.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const querySchema = z.object({
  status: z.enum(["live", "completed", "scheduled"]).optional(),
  tanggal: z.string().optional(),
  jadwal_id: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

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

    const { data: caller } = await adminClient
      .from("users")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    if (caller?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Access denied: Admin role required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const parsed = querySchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.errors[0].message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { status, tanggal, jadwal_id, page, limit } = parsed.data;
    const offset = (page - 1) * limit;

    let countQuery = adminClient
      .from("sesi_kehadiran")
      .select("sesi_id", { count: "exact", head: true });

    let dataQuery = adminClient
      .from("sesi_kehadiran")
      .select(`
        sesi_id,
        tanggal,
        waktu_mulai,
        waktu_selesai,
        status,
        jadwal_id,
        jadwal_kelas!inner(
          mk_id,
          dosen_id,
          ruangan_id,
          mata_kuliah!inner(kode_mk, nama_mk),
          dosen!inner(nama),
          ruangan!inner(nama_ruangan)
        )
      `);

    if (status) {
      const statusMap: Record<string, string> = {
        live: "live",
        completed: "completed",
        scheduled: "scheduled",
      };
      countQuery = countQuery.eq("status", statusMap[status]);
      dataQuery = dataQuery.eq("status", statusMap[status]);
    }
    if (tanggal) {
      countQuery = countQuery.eq("tanggal", tanggal);
      dataQuery = dataQuery.eq("tanggal", tanggal);
    }
    if (jadwal_id) {
      countQuery = countQuery.eq("jadwal_id", jadwal_id);
      dataQuery = dataQuery.eq("jadwal_id", jadwal_id);
    }

    const { count: total } = await countQuery;
    if (!total) {
      return new Response(JSON.stringify({ sessions: [], pagination: { page, limit, total: 0, total_pages: 0 } }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: sessions, error } = await dataQuery
      .order("tanggal", { ascending: false })
      .order("waktu_mulai", { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;
    if (!sessions || sessions.length === 0) {
      return new Response(JSON.stringify({ sessions: [], pagination: { page, limit, total, total_pages: Math.ceil(total / limit) } }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sesiIds = sessions.map((s: any) => s.sesi_id);
    const jadwalIds = [...new Set(sessions.map((s: any) => s.jadwal_id))];

    const [enrolledResult, attendanceResult] = await Promise.all([
      adminClient.from("pendaftaran_kelas").select("jadwal_id").in("jadwal_id", jadwalIds),
      adminClient.from("presensi").select("sesi_id, status").in("sesi_id", sesiIds),
    ]);

    const enrolledMap: Record<string, number> = {};
    if (enrolledResult.data) {
      for (const row of enrolledResult.data) {
        enrolledMap[row.jadwal_id] = (enrolledMap[row.jadwal_id] || 0) + 1;
      }
    }

    const attendanceMap: Record<string, { present: number; absent: number; excused: number; late: number }> = {};
    if (attendanceResult.data) {
      for (const row of attendanceResult.data) {
        if (!attendanceMap[row.sesi_id]) {
          attendanceMap[row.sesi_id] = { present: 0, absent: 0, excused: 0, late: 0 };
        }
        const s = row.status as string;
        if (s === "present" || s === "late") {
          attendanceMap[row.sesi_id][s]++;
        } else if (s === "absent" || s === "excused") {
          attendanceMap[row.sesi_id][s]++;
        }
      }
    }

    const result = sessions.map((s: any) => {
      const sesiAttendance = attendanceMap[s.sesi_id] || { present: 0, absent: 0, excused: 0, late: 0 };
      const enrolledCount = enrolledMap[s.jadwal_id] || 0;
      const totalAttendance = sesiAttendance.present + sesiAttendance.absent + sesiAttendance.excused + sesiAttendance.late;
      const attendanceRate = enrolledCount > 0
        ? Math.round(((sesiAttendance.present + sesiAttendance.late) / enrolledCount) * 10000) / 100
        : 0;

      return {
        sesi_id: s.sesi_id,
        tanggal: s.tanggal,
        waktu_mulai: s.waktu_mulai,
        waktu_selesai: s.waktu_selesai,
        status: s.status,
        mata_kuliah: s.jadwal_kelas.mata_kuliah,
        dosen: s.jadwal_kelas.dosen,
        ruangan: s.jadwal_kelas.ruangan,
        enrolled_count: enrolledCount,
        attendance_counts: {
          present: sesiAttendance.present,
          absent: sesiAttendance.absent,
          excused: sesiAttendance.excused,
          late: sesiAttendance.late,
          total: totalAttendance,
        },
        attendance_rate: attendanceRate,
      };
    });

    return new Response(JSON.stringify({
      sessions: result,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    }), {
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
