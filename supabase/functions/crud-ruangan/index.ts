import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getAdminClient, extractJwt, getClientIp } from "../_shared/supabase.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const listSchema = z.object({
  action: z.literal("list"),
  page: z.coerce.number().int().positive().optional().default(1),
  per_page: z.coerce.number().int().positive().max(100).optional().default(10),
  search: z.string().optional(),
  is_active: z.boolean().optional(),
  kapasitas_min: z.coerce.number().int().positive().optional(),
  kapasitas_max: z.coerce.number().int().positive().optional(),
});

const getSchema = z.object({
  action: z.literal("get"),
  ruangan_id: z.string().uuid(),
});

const createSchema = z.object({
  action: z.literal("create"),
  kode_ruangan: z.string().max(30),
  nama_ruangan: z.string().max(150),
  kapasitas: z.number().int().positive().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  geofence_radius_m: z.number().int().positive().optional().default(50),
});

const updateSchema = z.object({
  action: z.literal("update"),
  ruangan_id: z.string().uuid(),
  kode_ruangan: z.string().max(30).optional(),
  nama_ruangan: z.string().max(150).optional(),
  kapasitas: z.number().int().positive().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  geofence_radius_m: z.number().int().positive().optional(),
});

const deleteSchema = z.object({
  action: z.literal("delete"),
  ruangan_id: z.string().uuid(),
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
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid user token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: profile } = await adminClient.from("users").select("role").eq("user_id", user.id).maybeSingle();
    if (!profile || profile.role !== "admin") {
      return new Response(JSON.stringify({ error: "Admin access required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
      const { page, per_page, search, is_active, kapasitas_min, kapasitas_max } = parsed.data;
      const offset = (page - 1) * per_page;

      let query = adminClient.from("ruangan").select("*", { count: "exact" });

      if (search) {
        query = query.or(`kode_ruangan.ilike.%${search}%,nama_ruangan.ilike.%${search}%`);
      }
      if (is_active !== undefined) {
        query = query.eq("is_active", is_active);
      }
      if (kapasitas_min !== undefined) {
        query = query.gte("kapasitas", kapasitas_min);
      }
      if (kapasitas_max !== undefined) {
        query = query.lte("kapasitas", kapasitas_max);
      }

      query = query.order("kode_ruangan", { ascending: true }).range(offset, offset + per_page - 1);

      const { data, count, error } = await query;
      if (error) throw error;

      return new Response(JSON.stringify({ data, total: count, page, per_page }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "get") {
      const { ruangan_id } = parsed.data;
      const { data, error } = await adminClient.from("ruangan").select("*").eq("ruangan_id", ruangan_id).maybeSingle();
      if (error) throw error;
      if (!data) {
        return new Response(JSON.stringify({ error: "Ruangan not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({ data }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "create") {
      const { kode_ruangan, nama_ruangan, kapasitas, latitude, longitude, geofence_radius_m } = parsed.data;
      const { data, error } = await adminClient.from("ruangan").insert({
        kode_ruangan,
        nama_ruangan,
        kapasitas: kapasitas ?? null,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        geofence_radius_m,
      }).select().single();
      if (error) {
        if (error.code === "23505") {
          return new Response(JSON.stringify({ error: "Kode ruangan already exists" }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        throw error;
      }

      await adminClient.from("audit_log").insert({
        kategori: "Master Data",
        aksi: `Create ruangan: ${kode_ruangan} - ${nama_ruangan}`,
        ip_address: clientIp,
        user_id: user.id,
        status: "success",
      });

      return new Response(JSON.stringify({ data }), { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "update") {
      const { ruangan_id, ...fields } = parsed.data;
      const updateData: Record<string, unknown> = {};
      if (fields.kode_ruangan !== undefined) updateData.kode_ruangan = fields.kode_ruangan;
      if (fields.nama_ruangan !== undefined) updateData.nama_ruangan = fields.nama_ruangan;
      if (fields.kapasitas !== undefined) updateData.kapasitas = fields.kapasitas;
      if (fields.latitude !== undefined) updateData.latitude = fields.latitude;
      if (fields.longitude !== undefined) updateData.longitude = fields.longitude;
      if (fields.geofence_radius_m !== undefined) updateData.geofence_radius_m = fields.geofence_radius_m;

      if (Object.keys(updateData).length === 0) {
        return new Response(JSON.stringify({ error: "No fields to update" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: existing } = await adminClient.from("ruangan").select("kode_ruangan, nama_ruangan").eq("ruangan_id", ruangan_id).maybeSingle();
      if (!existing) {
        return new Response(JSON.stringify({ error: "Ruangan not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data, error } = await adminClient.from("ruangan").update(updateData).eq("ruangan_id", ruangan_id).select().single();
      if (error) {
        if (error.code === "23505") {
          return new Response(JSON.stringify({ error: "Kode ruangan already exists" }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        throw error;
      }

      await adminClient.from("audit_log").insert({
        kategori: "Master Data",
        aksi: `Update ruangan: ${existing.kode_ruangan} (${ruangan_id})`,
        ip_address: clientIp,
        user_id: user.id,
        status: "success",
      });

      return new Response(JSON.stringify({ data }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "delete") {
      const { ruangan_id } = parsed.data;

      const { data: existing } = await adminClient.from("ruangan").select("kode_ruangan, nama_ruangan").eq("ruangan_id", ruangan_id).maybeSingle();
      if (!existing) {
        return new Response(JSON.stringify({ error: "Ruangan not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { error } = await adminClient.from("ruangan").update({ is_active: false }).eq("ruangan_id", ruangan_id);
      if (error) throw error;

      await adminClient.from("audit_log").insert({
        kategori: "Master Data",
        aksi: `Soft-delete ruangan: ${existing.kode_ruangan} - ${existing.nama_ruangan} (${ruangan_id})`,
        ip_address: clientIp,
        user_id: user.id,
        status: "success",
      });

      return new Response(JSON.stringify({ message: "Ruangan deactivated successfully" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
