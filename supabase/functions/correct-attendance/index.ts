import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getAdminClient, extractJwt, getClientIp } from "../_shared/supabase.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const correctSchema = z.object({
  presensi_id: z.string().uuid(),
  status_baru: z.enum(["present", "absent", "excused", "late"]),
  alasan: z.string().optional(),
});

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response(JSON.stringify({ error: "Missing Authorization header" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

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
    const parsed = correctSchema.safeParse(body);
    if (!parsed.success) return new Response(JSON.stringify({ error: parsed.error.errors[0].message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { presensi_id, status_baru, alasan } = parsed.data;

    const { data: presensi } = await adminClient.from("presensi").select("presensi_id, status, sesi_id, sesi_kehadiran!inner(jadwal_id, jadwal_kelas!inner(dosen_id))").eq("presensi_id", presensi_id).maybeSingle();
    if (!presensi) return new Response(JSON.stringify({ error: "Presensi record not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!isAdmin && presensi.sesi_kehadiran?.jadwal_kelas?.dosen_id !== dosenId) return new Response(JSON.stringify({ error: "You are not the lecturer for this session" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const status_sebelum = presensi.status;

    const { error: koreksiError } = await adminClient.from("koreksi_presensi").insert({
      presensi_id, diubah_oleh: dosenId,
      status_sebelum, status_sesudah: status_baru, alasan: alasan || null,
    });
    if (koreksiError) throw koreksiError;

    const { error: updateError } = await adminClient.from("presensi").update({ status: status_baru }).eq("presensi_id", presensi_id);
    if (updateError) throw updateError;

    await adminClient.from("audit_log").insert({
      kategori: "Attendance Overrides", aksi: `Correction: presensi ${presensi_id} ${status_sebelum}→${status_baru}`,
      ip_address: clientIp, user_id: user.id, status: "success",
    });

    return new Response(JSON.stringify({ message: "Attendance corrected successfully" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
