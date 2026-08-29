import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getAdminClient, extractJwt, getClientIp } from "../_shared/supabase.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const listSchema = z.object({
  action: z.literal("list"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().optional(),
  prodi_id: z.number().int().optional(),
  angkatan: z.string().optional(),
  is_active: z.boolean().optional(),
});

const getSchema = z.object({
  action: z.literal("get"),
  mahasiswa_id: z.string().uuid(),
});

const createSchema = z.object({
  action: z.literal("create"),
  nim: z.string().max(30),
  nama: z.string().max(150),
  prodi_id: z.number().int(),
  angkatan: z.string().max(4).optional(),
  jenis_kelamin: z.enum(["L", "P"]).optional(),
  gpa: z.number().max(9.99).optional(),
  pembimbing_akademik: z.string().max(150).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
});

const updateSchema = z.object({
  action: z.literal("update"),
  mahasiswa_id: z.string().uuid(),
  nim: z.string().max(30).optional(),
  nama: z.string().max(150).optional(),
  prodi_id: z.number().int().optional(),
  angkatan: z.string().max(4).optional(),
  jenis_kelamin: z.enum(["L", "P"]).optional(),
  gpa: z.number().max(9.99).optional(),
  pembimbing_akademik: z.string().max(150).optional(),
  is_active: z.boolean().optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
});

const deleteSchema = z.object({
  action: z.literal("delete"),
  mahasiswa_id: z.string().uuid(),
});

const bodySchema = z.discriminatedUnion("action", [listSchema, getSchema, createSchema, updateSchema, deleteSchema]);

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

    const { data: profile } = await adminClient.from("users").select("role").eq("user_id", user.id).maybeSingle();
    if (!profile || !["admin", "super_admin", "admin_prodi"].includes(profile.role)) {
      return new Response(JSON.stringify({ error: "Forbidden: admin role required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.errors[0].message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { action } = parsed.data;

    if (action === "list") {
      const { page, limit, search, prodi_id, angkatan, is_active } = parsed.data;
      let query = adminClient.from("mahasiswa").select("*, program_studi:prodi_id(nama_prodi), users:user_id(email)", { count: "exact" });

      if (search) {
        query = query.or(`nim.ilike.%${search}%,nama.ilike.%${search}%`);
      }
      if (prodi_id !== undefined) query = query.eq("prodi_id", prodi_id);
      if (angkatan !== undefined) query = query.eq("angkatan", angkatan);
      if (is_active !== undefined) query = query.eq("is_active", is_active);

      const from = (page - 1) * limit;
      const to = from + limit - 1;

      const { data: mahasiswa, error, count } = await query.order("created_at", { ascending: false }).range(from, to);
      if (error) throw error;

      const total = count ?? 0;
      return new Response(JSON.stringify({
        mahasiswa,
        pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "get") {
      const { mahasiswa_id } = parsed.data;
      const { data: mhs, error } = await adminClient.from("mahasiswa").select("*, prodi:prodi_id(*)").eq("mahasiswa_id", mahasiswa_id).maybeSingle();
      if (error) throw error;
      if (!mhs) return new Response(JSON.stringify({ error: "Mahasiswa not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      return new Response(JSON.stringify(mhs), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "create") {
      const { action: _, email, password, ...mahasiswaData } = parsed.data;

      let user_id: string | undefined;

      if (email && password) {
        const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
          email, password, email_confirm: true,
        });
        if (authError) throw authError;
        user_id = authUser.user.id;

        const { error: insertUserError } = await adminClient.from("users").insert({
          user_id, name: mahasiswaData.nama, email, role: "mahasiswa",
        });
        if (insertUserError) {
          await adminClient.auth.admin.deleteUser(user_id);
          throw insertUserError;
        }
      }

      const { data: mhs, error: insertError } = await adminClient.from("mahasiswa").insert({
        ...mahasiswaData,
        user_id: user_id ?? null,
      }).select().single();
      
      if (insertError) {
        if (user_id) {
          await adminClient.from("users").delete().eq("user_id", user_id);
          await adminClient.auth.admin.deleteUser(user_id);
        }
        throw insertError;
      }

      await adminClient.from("audit_log").insert({
        kategori: "Master Data",
        aksi: `Created mahasiswa ${mhs.nim} - ${mhs.nama}`,
        ip_address: clientIp,
        user_id: user.id,
        status: "success",
      });

      return new Response(JSON.stringify(mhs), { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "update") {
      const { action: _, mahasiswa_id, email, password, ...fields } = parsed.data;

      const { data: existing } = await adminClient.from("mahasiswa").select("mahasiswa_id, nama").eq("mahasiswa_id", mahasiswa_id).maybeSingle();
      if (!existing) return new Response(JSON.stringify({ error: "Mahasiswa not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      if (email || password) {
        const { data: mhsRow } = await adminClient.from("mahasiswa").select("user_id").eq("mahasiswa_id", mahasiswa_id).maybeSingle();
        if (mhsRow?.user_id) {
          if (email) {
            const { error: emailError } = await adminClient.from("users").update({ email }).eq("user_id", mhsRow.user_id);
            if (emailError) throw emailError;
          }
          if (password) {
            const { error: passError } = await adminClient.auth.admin.updateUserById(mhsRow.user_id, { password });
            if (passError) throw passError;
          }
        } else if (email && password) {
          const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({ email, password, email_confirm: true });
          if (authError) throw authError;
          if (authUser) {
            const studentName = fields.nama || existing.nama;
            const { error: insertUserError } = await adminClient.from("users").insert({ user_id: authUser.user.id, name: studentName, email, role: "mahasiswa" });
            if (insertUserError) {
              await adminClient.auth.admin.deleteUser(authUser.user.id);
              throw insertUserError;
            }
            const { error: mhsUpdateError } = await adminClient.from("mahasiswa").update({ user_id: authUser.user.id }).eq("mahasiswa_id", mahasiswa_id);
            if (mhsUpdateError) {
              await adminClient.from("users").delete().eq("user_id", authUser.user.id);
              await adminClient.auth.admin.deleteUser(authUser.user.id);
              throw mhsUpdateError;
            }
          }
        }
      }

      const { data: mhs, error: updateError } = await adminClient.from("mahasiswa").update(fields).eq("mahasiswa_id", mahasiswa_id).select().single();
      if (updateError) throw updateError;

      await adminClient.from("audit_log").insert({
        kategori: "Master Data",
        aksi: `Updated mahasiswa ${mhs.mahasiswa_id}`,
        ip_address: clientIp,
        user_id: user.id,
        status: "success",
      });

      return new Response(JSON.stringify(mhs), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "delete") {
      const { mahasiswa_id } = parsed.data;

      const { data: existing } = await adminClient.from("mahasiswa").select("mahasiswa_id, nim, nama").eq("mahasiswa_id", mahasiswa_id).maybeSingle();
      if (!existing) return new Response(JSON.stringify({ error: "Mahasiswa not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const { error: deleteError } = await adminClient.from("mahasiswa").update({ is_active: false }).eq("mahasiswa_id", mahasiswa_id);
      if (deleteError) throw deleteError;

      await adminClient.from("audit_log").insert({
        kategori: "Master Data",
        aksi: `Deleted (soft) mahasiswa ${existing.nim} - ${existing.nama}`,
        ip_address: clientIp,
        user_id: user.id,
        status: "success",
      });

      return new Response(JSON.stringify({ message: "Mahasiswa deactivated successfully" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
