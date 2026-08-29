import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getAdminClient, extractJwt, requireRole } from "../_shared/supabase.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const courseStudentsSchema = z.object({
  jadwal_id: z.string().uuid(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().optional(),
  sesi_id: z.string().uuid().optional(),
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
    const parsed = courseStudentsSchema.safeParse(body);
    if (!parsed.success) return new Response(JSON.stringify({ error: parsed.error.errors[0].message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { jadwal_id, page, limit, search, sesi_id } = parsed.data;

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
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = adminClient.from("pendaftaran_kelas").select(`
      mahasiswa_id,
      mahasiswa!inner(mahasiswa_id, nim, nama, gpa)
    `, { count: "exact" }).eq("jadwal_id", jadwal_id).range(from, to);

    if (search) {
      query = query.or(`mahasiswa.nim.ilike.%${search}%,mahasiswa.nama.ilike.%${search}%`);
    }

    const { data: enrollments, count, error } = await query;
    if (error) throw error;

    let attendanceMap = new Map();
    if (sesi_id) {
      const { data: presensi } = await adminClient.from("presensi").select("presensi_id, mahasiswa_id, status, waktu_check_in, geofence_flagged")
        .eq("sesi_id", sesi_id).in("mahasiswa_id", (enrollments || []).map((e: any) => e.mahasiswa_id));
      attendanceMap = new Map((presensi || []).map((p: any) => [p.mahasiswa_id, p]));
    }

    const students = (enrollments || []).map((e: any) => ({
      mahasiswa_id: e.mahasiswa.mahasiswa_id,
      nim: e.mahasiswa.nim,
      nama: e.mahasiswa.nama,
      gpa: e.mahasiswa.gpa,
      attendance: attendanceMap.get(e.mahasiswa_id) || null,
    }));

    return new Response(JSON.stringify({ students, pagination: { page, limit, total: count || 0, total_pages: Math.ceil((count || 0) / limit) } }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
