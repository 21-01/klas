import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getAdminClient, extractJwt, getClientIp } from "../_shared/supabase.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const listSessionsSchema = z.object({
  jadwal_id: z.string().uuid("Invalid jadwal ID"),
  page: z.number().int().min(1).optional().default(1),
  limit: z.number().int().min(1).max(100).optional().default(10),
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
    const parsed = listSessionsSchema.safeParse(body);
    if (!parsed.success) return new Response(JSON.stringify({ error: parsed.error.errors[0].message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { jadwal_id, page, limit } = parsed.data;

    const { data: jadwal } = await adminClient.from("jadwal_kelas").select("dosen_id").eq("jadwal_id", jadwal_id).maybeSingle();
    if (!jadwal) return new Response(JSON.stringify({ error: "Jadwal not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!isAdmin && jadwal.dosen_id !== dosenId) return new Response(JSON.stringify({ error: "You are not the lecturer for this class" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const offset = (page - 1) * limit;

    const { count } = await adminClient.from("sesi_kehadiran").select("sesi_id", { count: "exact", head: true }).eq("jadwal_id", jadwal_id);

    const { data: sessions, error: queryError } = await adminClient
      .from("sesi_kehadiran")
      .select("sesi_id, jadwal_id, tanggal, waktu_mulai, waktu_selesai, status, geofence_radius_m, qr_rotates_every")
      .eq("jadwal_id", jadwal_id)
      .order("tanggal", { ascending: false })
      .order("waktu_mulai", { ascending: false })
      .range(offset, offset + limit - 1);

    if (queryError) throw queryError;

    const sessionIds = (sessions || []).map((s: any) => s.sesi_id);

    let attendanceCounts: Record<string, { present: number; absent: number }> = {};
    if (sessionIds.length > 0) {
      const { data: presensi } = await adminClient
        .from("presensi")
        .select("sesi_id, status")
        .in("sesi_id", sessionIds);

      if (presensi) {
        for (const p of presensi as any[]) {
          if (!attendanceCounts[p.sesi_id]) {
            attendanceCounts[p.sesi_id] = { present: 0, absent: 0 };
          }
          if (p.status === "present" || p.status === "late" || p.status === "excused") {
            attendanceCounts[p.sesi_id].present++;
          } else if (p.status === "absent") {
            attendanceCounts[p.sesi_id].absent++;
          }
        }
      }

      const { count: enrolledCount } = await adminClient
        .from("pendaftaran_kelas")
        .select("mahasiswa_id", { count: "exact", head: true })
        .eq("jadwal_id", jadwal_id);

      const totalStudents = enrolledCount || 0;
      for (const sid of sessionIds) {
        if (!attendanceCounts[sid]) {
          attendanceCounts[sid] = { present: 0, absent: totalStudents };
        } else {
          const present = attendanceCounts[sid].present;
          attendanceCounts[sid].absent = Math.max(0, totalStudents - present);
        }
      }
    }

    const sessionsWithCounts = (sessions || []).map((s: any) => {
      const counts = attendanceCounts[s.sesi_id] || { present: 0, absent: 0 };
      return {
        ...s,
        present_count: counts.present,
        absent_count: counts.absent,
        total_count: counts.present + counts.absent,
      };
    });

    const total = count || 0;
    const total_pages = Math.ceil(total / limit);

    await adminClient.from("audit_log").insert({
      kategori: "Attendance Overrides", aksi: `Session list viewed for jadwal ${jadwal_id} by ${isAdmin ? "admin" : "dosen " + dosenId}`,
      ip_address: clientIp, user_id: user.id, status: "success",
    });

    return new Response(JSON.stringify({ sessions: sessionsWithCounts, pagination: { page, limit, total, total_pages } }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
