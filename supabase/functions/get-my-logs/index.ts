import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getAdminClient, getUserClient, extractJwt } from "../_shared/supabase.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const logsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
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
    const parsed = logsQuerySchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.errors[0].message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { page, limit, semester, tahun_akademik } = parsed.data;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = userClient
      .from("presensi")
      .select(`
        presensi_id, waktu_check_in, status, metode, latitude, longitude, geofence_flagged, geofence_delta_m,
        sesi_kehadiran!inner(
          tanggal, waktu_mulai, waktu_selesai,
          jadwal_kelas!inner(
            mata_kuliah!inner(kode_mk, nama_mk, sks)
          )
        )
      `, { count: "exact" })
      .eq("mahasiswa_id", mhs.mahasiswa_id)
      .order("waktu_check_in", { ascending: false })
      .range(from, to);

    if (semester) {
      query = query.eq("sesi_kehadiran.jadwal_kelas.semester", semester);
    }
    if (tahun_akademik) {
      query = query.eq("sesi_kehadiran.jadwal_kelas.tahun_akademik", tahun_akademik);
    }

    const { data: logs, count, error } = await query;

    if (error) throw error;

    return new Response(
      JSON.stringify({
        logs: logs || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          total_pages: Math.ceil((count || 0) / limit),
        },
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
