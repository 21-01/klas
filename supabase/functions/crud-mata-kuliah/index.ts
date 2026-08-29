import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getAdminClient, extractJwt, getClientIp } from "../_shared/supabase.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const listSchema = z.object({
  action: z.literal("list"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  prodi_id: z.coerce.number().int().optional(),
  sks: z.coerce.number().int().min(1).max(6).optional(),
  is_active: z.coerce.boolean().optional(),
});

const getSchema = z.object({
  action: z.literal("get"),
  mk_id: z.string().uuid(),
});

const createSchema = z.object({
  action: z.literal("create"),
  kode_mk: z.string().max(20).min(1),
  nama_mk: z.string().max(200).min(1),
  sks: z.number().int().min(1).max(6),
  prodi_id: z.number().int(),
});

const updateSchema = z.object({
  action: z.literal("update"),
  mk_id: z.string().uuid(),
  kode_mk: z.string().max(20).optional(),
  nama_mk: z.string().max(200).optional(),
  sks: z.number().int().min(1).max(6).optional(),
  prodi_id: z.number().int().optional(),
  is_active: z.boolean().optional(),
});

const deleteSchema = z.object({
  action: z.literal("delete"),
  mk_id: z.string().uuid(),
});

const actionSchema = z.discriminatedUnion("action", [listSchema, getSchema, createSchema, updateSchema, deleteSchema]);

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
  const clientIp = getClientIp(req);

  try {
    const { data: { user }, error: userError } = await adminClient.auth.getUser(jwt);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid user token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callerProfile } = await adminClient
      .from("users")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    const callerRole = callerProfile?.role || user.user_metadata?.role || "";
    const isAdmin = callerRole === "admin" || callerRole === "super_admin";

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Access denied: Admin role required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.errors[0].message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action } = parsed.data;

    if (action === "list") {
      const { page, limit, search, prodi_id, sks, is_active } = parsed.data;
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      let query = adminClient
        .from("mata_kuliah")
        .select("*, program_studi!inner(prodi_id, nama_prodi)", { count: "exact" })
        .range(from, to)
        .order("kode_mk", { ascending: true });

      if (search) {
        query = query.or(`kode_mk.ilike.%${search}%,nama_mk.ilike.%${search}%`);
      }
      if (prodi_id !== undefined) {
        query = query.eq("prodi_id", prodi_id);
      }
      if (sks !== undefined) {
        query = query.eq("sks", sks);
      }
      if (is_active !== undefined) {
        query = query.eq("is_active", is_active);
      }

      const { data: rows, count, error } = await query;
      if (error) throw error;

      return new Response(
        JSON.stringify({
          data: rows || [],
          pagination: { page, limit, total: count || 0, total_pages: Math.ceil((count || 0) / limit) },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "get") {
      const { mk_id } = parsed.data;

      const { data: row, error } = await adminClient
        .from("mata_kuliah")
        .select("*, program_studi!inner(prodi_id, nama_prodi)")
        .eq("mk_id", mk_id)
        .maybeSingle();

      if (error) throw error;
      if (!row) {
        return new Response(JSON.stringify({ error: "Mata kuliah not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ data: row }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create") {
      const { kode_mk, nama_mk, sks, prodi_id } = parsed.data;

      const { data: row, error } = await adminClient
        .from("mata_kuliah")
        .insert({ kode_mk, nama_mk, sks, prodi_id })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          return new Response(JSON.stringify({ error: "Kode mata kuliah already exists" }), {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw error;
      }

      await adminClient.from("audit_log").insert({
        kategori: "Master Data",
        aksi: `Created mata kuliah ${kode_mk} - ${nama_mk}`,
        ip_address: clientIp,
        user_id: user.id,
        status: "success",
      });

      return new Response(JSON.stringify({ data: row, mk_id: row.mk_id }), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update") {
      const { action: _, mk_id, ...fields } = parsed.data;

      const { data: row, error } = await adminClient
        .from("mata_kuliah")
        .update(fields)
        .eq("mk_id", mk_id)
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          return new Response(JSON.stringify({ error: "Kode mata kuliah already exists" }), {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (error.code === "PGRST116") {
          return new Response(JSON.stringify({ error: "Mata kuliah not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw error;
      }

      await adminClient.from("audit_log").insert({
        kategori: "Master Data",
        aksi: `Updated mata kuliah ${mk_id}`,
        ip_address: clientIp,
        user_id: user.id,
        status: "success",
      });

      return new Response(JSON.stringify({ data: row, mk_id: row.mk_id }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      const { mk_id } = parsed.data;

      const { data: row, error } = await adminClient
        .from("mata_kuliah")
        .delete()
        .eq("mk_id", mk_id)
        .select()
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return new Response(JSON.stringify({ error: "Mata kuliah not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw error;
      }

      await adminClient.from("audit_log").insert({
        kategori: "Master Data",
        aksi: `Deleted mata kuliah ${mk_id}`,
        ip_address: clientIp,
        user_id: user.id,
        status: "success",
      });

      return new Response(JSON.stringify({ message: "Mata kuliah deleted successfully", mk_id }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
