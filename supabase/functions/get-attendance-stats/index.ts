import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getAdminClient, getUserClient, extractJwt } from "../_shared/supabase.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const statsQuerySchema = z.object({
  semester: z.string().optional(),
  tahun_akademik: z.string().optional(),
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

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const parsed = statsQuerySchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.errors[0].message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { semester, tahun_akademik } = parsed.data;

    // Build the base filter through FK chain
    let query = userClient
      .from("presensi")
      .select("status", { count: "exact" })
      .eq("mahasiswa_id", mhs.mahasiswa_id);

    if (semester) {
      query = query.eq("sesi_kehadiran.jadwal_kelas.semester", semester);
    }
    if (tahun_akademik) {
      query = query.eq("sesi_kehadiran.jadwal_kelas.tahun_akademik", tahun_akademik);
    }

    // Get total
    const { count: total } = await query;

    // Count by status
    const statuses = ["present", "absent", "excused", "late"];
    const breakdown: Record<string, number> = {};

    for (const s of statuses) {
      let q = userClient
        .from("presensi")
        .select("status", { count: "exact", head: true })
        .eq("mahasiswa_id", mhs.mahasiswa_id)
        .eq("status", s);

      if (semester) q = q.eq("sesi_kehadiran.jadwal_kelas.semester", semester);
      if (tahun_akademik) q = q.eq("sesi_kehadiran.jadwal_kelas.tahun_akademik", tahun_akademik);

      const { count } = await q;
      breakdown[s] = count || 0;
    }

    const hadir = breakdown["present"] + breakdown["late"];
    const attendanceRate = total && total > 0 ? Math.round((hadir / total) * 10000) / 100 : 0;

    return new Response(
      JSON.stringify({
        total_sessions: total || 0,
        breakdown,
        attendance_rate: attendanceRate,
        semester: semester || null,
        tahun_akademik: tahun_akademik || null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
