import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getAdminClient, extractJwt, requireRole } from "../_shared/supabase.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const exportSchema = z.object({
  jadwal_id: z.string().uuid(),
  format: z.enum(["csv"]).default("csv"),
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
    const parsed = exportSchema.safeParse(body);
    if (!parsed.success) return new Response(JSON.stringify({ error: parsed.error.errors[0].message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { jadwal_id, format: _ } = parsed.data;

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

    const { data: sessions } = await adminClient.from("sesi_kehadiran").select("sesi_id, tanggal, status").eq("jadwal_id", jadwal_id).order("tanggal", { ascending: true });
    const sessionIds = (sessions || []).map((s: any) => s.sesi_id);

    const { data: enrollments } = await adminClient.from("pendaftaran_kelas").select(`
      mahasiswa_id, mahasiswa!inner(nim, nama)
    `).eq("jadwal_id", jadwal_id);

    let csv = "NIM,Nama,";
    csv += (sessions || []).map((s: any) => s.tanggal).join(",");
    csv += ",Rate\n";

    for (const e of (enrollments || [])) {
      const { data: attendance } = await adminClient.from("presensi").select("status, sesi_id").eq("mahasiswa_id", e.mahasiswa_id).in("sesi_id", sessionIds);
      const attMap = new Map((attendance || []).map((a: any) => [a.sesi_id, a.status === "present" || a.status === "late" ? "P" : a.status === "excused" ? "E" : a.status === "absent" ? "A" : ""]));
      const presentCount = (attendance || []).filter((a: any) => a.status === "present" || a.status === "late").length;
      const rate = sessionIds.length > 0 ? ((presentCount / sessionIds.length) * 100).toFixed(1) : "0.0";
      const row = [e.mahasiswa.nim, e.mahasiswa.nama, ...(sessions || []).map((s: any) => attMap.get(s.sesi_id) || ""), `${rate}%`].join(",");
      csv += row + "\n";
    }

    return new Response(csv, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="report-${jadwal_id}.csv"`,
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
