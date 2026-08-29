const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  return null;
}

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

function getAdminClient() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}

function extractJwt(authHeader: string): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("CF-Connecting-IP")?.trim() ||
    "127.0.0.1"
  );
}

Deno.serve(async (req: Request) => {
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

    const { data: profile } = await adminClient.from("users").select("role").eq("user_id", user.id).maybeSingle();
    if (!profile || !["admin", "super_admin", "admin_prodi"].includes(profile.role)) {
      return new Response(JSON.stringify({ error: "Forbidden: admin role required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const action = body.action as string;

    if (action === "list") {
      const page = Number(body.page) || 1;
      const limit = Math.min(Number(body.limit) || 50, 100);
      let query = adminClient.from("jadwal_kelas").select("*, mata_kuliah!inner(kode_mk, nama_mk, sks, prodi_id), dosen(nama), ruangan(nama_ruangan)", { count: "exact" });
      if (body.semester) query = query.eq("semester", body.semester);
      if (body.tahun_akademik) query = query.eq("tahun_akademik", body.tahun_akademik);
      if (body.hari) query = query.eq("hari", body.hari);
      if (body.prodi_id !== undefined) query = query.eq("mata_kuliah.prodi_id", body.prodi_id);
      if (body.dosen_id) query = query.eq("dosen_id", body.dosen_id);
      if (body.ruangan_id) query = query.eq("ruangan_id", body.ruangan_id);
      if (body.status) query = query.eq("status", body.status);
      const from = (page - 1) * limit;
      const { data: jadwal, error, count } = await query.order("created_at", { ascending: false }).range(from, from + limit - 1);
      if (error) throw error;
      return new Response(JSON.stringify({
        jadwal,
        pagination: { page, limit, total: count ?? 0, total_pages: Math.ceil((count ?? 0) / limit) },
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "get") {
      const jadwal_id = body.jadwal_id as string;
      const { data: jadwal, error } = await adminClient.from("jadwal_kelas").select("*, mata_kuliah!inner(kode_mk, nama_mk, sks, prodi_id), dosen(nama), ruangan(nama_ruangan)").eq("jadwal_id", jadwal_id).maybeSingle();
      if (error) throw error;
      if (!jadwal) return new Response(JSON.stringify({ error: "Jadwal not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify(jadwal), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "create") {
      const { mk_id, dosen_id, ruangan_id, hari, waktu_mulai, waktu_selesai, semester, tahun_akademik, quota } = body as any;
      const status = !dosen_id ? "unassigned" : !ruangan_id ? "room-missing" : "assigned";
      const { data: jadwal, error: insertError } = await adminClient.from("jadwal_kelas").insert({
        mk_id, dosen_id: dosen_id ?? null, ruangan_id: ruangan_id ?? null,
        hari, waktu_mulai, waktu_selesai, semester, tahun_akademik, status, quota: quota ?? 0,
      }).select().single();
      if (insertError) throw insertError;
      await adminClient.from("audit_log").insert({
        kategori: "Schedule Plotting",
        aksi: `Created jadwal ${jadwal.jadwal_id} - ${hari} ${waktu_mulai}-${waktu_selesai}`,
        ip_address: clientIp, user_id: user.id, status: "success",
      });
      return new Response(JSON.stringify(jadwal), { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "update") {
      const { jadwal_id, ...fields } = body as any;
      const { data: existing } = await adminClient.from("jadwal_kelas").select("jadwal_id, dosen_id, ruangan_id").eq("jadwal_id", jadwal_id).maybeSingle();
      if (!existing) return new Response(JSON.stringify({ error: "Jadwal not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const resolvedDosen = fields.dosen_id !== undefined ? fields.dosen_id : existing.dosen_id;
      const resolvedRuangan = fields.ruangan_id !== undefined ? fields.ruangan_id : existing.ruangan_id;
      const status = !resolvedDosen ? "unassigned" : !resolvedRuangan ? "room-missing" : "assigned";
      const { data: jadwal, error: updateError } = await adminClient.from("jadwal_kelas").update({ ...fields, status }).eq("jadwal_id", jadwal_id).select().single();
      if (updateError) throw updateError;
      await adminClient.from("audit_log").insert({
        kategori: "Schedule Plotting", aksi: `Updated jadwal ${jadwal.jadwal_id}`,
        ip_address: clientIp, user_id: user.id, status: "success",
      });
      return new Response(JSON.stringify(jadwal), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "delete") {
      const jadwal_id = body.jadwal_id as string;
      const { data: existing } = await adminClient.from("jadwal_kelas").select("jadwal_id").eq("jadwal_id", jadwal_id).maybeSingle();
      if (!existing) return new Response(JSON.stringify({ error: "Jadwal not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { error: deleteError } = await adminClient.from("jadwal_kelas").update({ is_active: false }).eq("jadwal_id", jadwal_id);
      if (deleteError) throw deleteError;
      await adminClient.from("audit_log").insert({
        kategori: "Schedule Plotting", aksi: `Deleted (soft) jadwal ${jadwal_id}`,
        ip_address: clientIp, user_id: user.id, status: "success",
      });
      return new Response(JSON.stringify({ message: "Jadwal deactivated successfully" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "list-enrolled") {
      const jadwal_id = body.jadwal_id as string;
      const { data: enrollments, error: enrollError } = await adminClient
        .from("pendaftaran_kelas")
        .select("pendaftaran_id, mahasiswa_id, created_at, mahasiswa!inner(mahasiswa_id, nim, nama)")
        .eq("jadwal_id", jadwal_id)
        .order("created_at", { ascending: false });
      if (enrollError) throw enrollError;
      return new Response(JSON.stringify({ enrolled: enrollments || [] }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "toggle-enroll") {
      const { jadwal_id, mahasiswa_id } = body as { jadwal_id: string; mahasiswa_id: string };
      const { data: existing } = await adminClient
        .from("pendaftaran_kelas")
        .select("pendaftaran_id")
        .eq("jadwal_id", jadwal_id)
        .eq("mahasiswa_id", mahasiswa_id)
        .maybeSingle();
      if (existing) {
        const { error: delError } = await adminClient
          .from("pendaftaran_kelas")
          .delete()
          .eq("pendaftaran_id", existing.pendaftaran_id);
        if (delError) throw delError;
        await adminClient.from("audit_log").insert({
          kategori: "Schedule Plotting", aksi: `Unenrolled mahasiswa ${mahasiswa_id} from jadwal ${jadwal_id}`,
          ip_address: clientIp, user_id: user.id, status: "success",
        });
        return new Response(JSON.stringify({ enrolled: false }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } else {
        const { error: insError } = await adminClient
          .from("pendaftaran_kelas")
          .insert({ jadwal_id, mahasiswa_id });
        if (insError) throw insError;
        await adminClient.from("audit_log").insert({
          kategori: "Schedule Plotting", aksi: `Enrolled mahasiswa ${mahasiswa_id} to jadwal ${jadwal_id}`,
          ip_address: clientIp, user_id: user.id, status: "success",
        });
        return new Response(JSON.stringify({ enrolled: true }), { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
