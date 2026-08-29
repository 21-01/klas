import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getAdminClient, extractJwt, getClientIp } from "../_shared/supabase.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const listSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
  prodi_id: z.coerce.number().int().optional(),
  is_active: z.coerce.boolean().optional(),
});

const getSchema = z.object({
  dosen_id: z.string().uuid("Invalid dosen ID"),
});

const createSchema = z.object({
  nip: z.string().max(30).optional().nullable(),
  nidn: z.string().max(30).optional().nullable(),
  nama: z.string().min(1, "Nama is required").max(150),
  prodi_id: z.number().int("Program studi ID is required"),
  jenis_kelamin: z.enum(["L", "P"]).optional().nullable(),
  email: z.string().email("Invalid email").optional().nullable(),
  password: z.string().min(8, "Password must be at least 8 characters").optional().nullable(),
});

const updateSchema = z.object({
  dosen_id: z.string().uuid("Invalid dosen ID"),
  nip: z.string().max(30).optional().nullable(),
  nidn: z.string().max(30).optional().nullable(),
  nama: z.string().max(150).optional(),
  prodi_id: z.number().int().optional(),
  jenis_kelamin: z.enum(["L", "P"]).optional().nullable(),
  is_active: z.boolean().optional(),
  email: z.string().email().optional().nullable(),
  password: z.string().min(6).optional().nullable(),
});

const deleteSchema = z.object({
  dosen_id: z.string().uuid("Invalid dosen ID"),
});

const bodySchema = z.object({
  action: z.enum(["list", "get", "create", "update", "delete"]),
}).passthrough();

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

    const { data: callerProfile } = await adminClient.from("users").select("role").eq("user_id", user.id).maybeSingle();
    if (callerProfile?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Access denied: Admin role required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const parsedAction = bodySchema.safeParse(body);
    if (!parsedAction.success) return new Response(JSON.stringify({ error: parsedAction.error.errors[0].message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { action, ...payload } = body;

    switch (action) {
      case "list": {
        const parsed = listSchema.safeParse(payload);
        if (!parsed.success) return new Response(JSON.stringify({ error: parsed.error.errors[0].message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

        const { page, limit, search, prodi_id, is_active } = parsed.data;
        const offset = (page - 1) * limit;

        let query = adminClient.from("dosen").select("*, program_studi:prodi_id(nama_prodi), users:user_id(email)", { count: "exact" });

        if (search) {
          query = query.or(`nama.ilike.%${search}%,nip.ilike.%${search}%,nidn.ilike.%${search}%`);
        }
        if (prodi_id !== undefined) {
          query = query.eq("prodi_id", prodi_id);
        }
        if (is_active !== undefined) {
          query = query.eq("is_active", is_active);
        }

        const { data: dosen, count, error } = await query.order("nama", { ascending: true }).range(offset, offset + limit - 1);
        if (error) throw error;

        return new Response(JSON.stringify({ data: dosen, total: count, page, limit }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "get": {
        const parsed = getSchema.safeParse(payload);
        if (!parsed.success) return new Response(JSON.stringify({ error: parsed.error.errors[0].message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

        const { dosen_id } = parsed.data;
        const { data: dosen, error } = await adminClient.from("dosen").select("*, program_studi:prodi_id(nama_prodi)").eq("dosen_id", dosen_id).maybeSingle();
        if (error) throw error;
        if (!dosen) return new Response(JSON.stringify({ error: "Dosen not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

        return new Response(JSON.stringify(dosen), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "create": {
        const parsed = createSchema.safeParse(payload);
        if (!parsed.success) return new Response(JSON.stringify({ error: parsed.error.errors[0].message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

        const { email, password, nip, nidn, nama, prodi_id, jenis_kelamin } = parsed.data;

        let newUserId: string | undefined;

        if (email && password) {
          const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
            email, password, email_confirm: true,
            user_metadata: { name: nama, role: "dosen" },
          });
          if (authError) throw new Error(`Auth creation failed: ${authError.message}`);
          if (!authData.user) throw new Error("Auth user creation returned no user");

          newUserId = authData.user.id;

          const { error: userInsertError } = await adminClient.from("users").insert({
            user_id: newUserId, name: nama, email, role: "dosen",
          });
          if (userInsertError) {
            await adminClient.auth.admin.deleteUser(newUserId);
            throw new Error(`Failed to create user profile: ${userInsertError.message}`);
          }
        }

        const { data: dosen, error: insertError } = await adminClient.from("dosen").insert({
          ...(newUserId && { user_id: newUserId }),
          ...(nip !== undefined && { nip }),
          ...(nidn !== undefined && { nidn }),
          nama, prodi_id,
          ...(jenis_kelamin !== undefined && { jenis_kelamin }),
        }).select("*, program_studi:prodi_id(nama_prodi)").single();

        if (insertError) {
          if (newUserId) {
            await adminClient.from("users").delete().eq("user_id", newUserId);
            await adminClient.auth.admin.deleteUser(newUserId);
          }
          throw insertError;
        }

        await adminClient.from("audit_log").insert({
          kategori: "Master Data",
          aksi: `Created dosen ${nama} (${nip || nidn || "N/A"})`,
          ip_address: clientIp, user_id: user.id, status: "success",
        });

        return new Response(JSON.stringify(dosen), { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "update": {
        const parsed = updateSchema.safeParse(payload);
        if (!parsed.success) return new Response(JSON.stringify({ error: parsed.error.errors[0].message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

        const { dosen_id, email, password, ...fields } = parsed.data;

        const { data: existing } = await adminClient.from("dosen").select("nama").eq("dosen_id", dosen_id).maybeSingle();
        if (!existing) return new Response(JSON.stringify({ error: "Dosen not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

        if (email || password) {
          const { data: dosenRow } = await adminClient.from("dosen").select("user_id").eq("dosen_id", dosen_id).maybeSingle();
          if (dosenRow?.user_id) {
            if (email) {
              const { error: emailError } = await adminClient.from("users").update({ email }).eq("user_id", dosenRow.user_id);
              if (emailError) throw emailError;
            }
            if (password) {
              const { error: passError } = await adminClient.auth.admin.updateUserById(dosenRow.user_id, { password });
              if (passError) throw passError;
            }
          } else if (email && password) {
            const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name: existing.nama, role: "dosen" } });
            if (authError) throw authError;
            if (authUser) {
              const { error: userInsertError } = await adminClient.from("users").insert({ user_id: authUser.user.id, name: existing.nama, email, role: "dosen" });
              if (userInsertError) {
                await adminClient.auth.admin.deleteUser(authUser.user.id);
                throw userInsertError;
              }
              const { error: dosenUpdateError } = await adminClient.from("dosen").update({ user_id: authUser.user.id }).eq("dosen_id", dosen_id);
              if (dosenUpdateError) {
                await adminClient.from("users").delete().eq("user_id", authUser.user.id);
                await adminClient.auth.admin.deleteUser(authUser.user.id);
                throw dosenUpdateError;
              }
            }
          }
        }

        const updateData: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(fields)) {
          if (value !== undefined) updateData[key] = value;
        }
        if (Object.keys(updateData).length === 0) return new Response(JSON.stringify({ error: "No fields to update" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

        const { data: dosen, error } = await adminClient.from("dosen").update(updateData).eq("dosen_id", dosen_id).select("*, program_studi:prodi_id(nama_prodi)").single();
        if (error) throw error;

        await adminClient.from("audit_log").insert({
          kategori: "Master Data",
          aksi: `Updated dosen ${existing.nama} (${dosen_id})`,
          ip_address: clientIp, user_id: user.id, status: "success",
        });

        return new Response(JSON.stringify(dosen), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "delete": {
        const parsed = deleteSchema.safeParse(payload);
        if (!parsed.success) return new Response(JSON.stringify({ error: parsed.error.errors[0].message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

        const { dosen_id } = parsed.data;

        const { data: existing } = await adminClient.from("dosen").select("nama").eq("dosen_id", dosen_id).maybeSingle();
        if (!existing) return new Response(JSON.stringify({ error: "Dosen not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

        const { error } = await adminClient.from("dosen").update({ is_active: false }).eq("dosen_id", dosen_id);
        if (error) throw error;

        await adminClient.from("audit_log").insert({
          kategori: "Master Data",
          aksi: `Soft-deleted dosen ${existing.nama} (${dosen_id})`,
          ip_address: clientIp, user_id: user.id, status: "success",
        });

        return new Response(JSON.stringify({ message: "Dosen deactivated successfully" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      default:
        return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
