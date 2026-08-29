import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getAdminClient, extractJwt } from "../_shared/supabase.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const listSchema = z.object({
  action: z.literal("list"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  is_read: z.boolean().optional(),
  tipe: z.string().optional(),
  user_id: z.string().uuid().optional(),
  from_date: z.string().optional(),
  to_date: z.string().optional(),
});

const markReadSchema = z.object({
  action: z.literal("mark-read"),
  notifikasi_id: z.union([z.string().uuid(), z.array(z.string().uuid())]),
});

const markAllReadSchema = z.object({
  action: z.literal("mark-all-read"),
  user_id: z.string().uuid().optional(),
});

const statsSchema = z.object({
  action: z.literal("stats"),
});

const bodySchema = z.discriminatedUnion("action", [listSchema, markReadSchema, markAllReadSchema, statsSchema]);

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing Authorization header" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const adminClient = getAdminClient();
  const jwt = extractJwt(authHeader);

  try {
    const { data: { user }, error: userError } = await adminClient.auth.getUser(jwt);
    if (userError || !user) return new Response(JSON.stringify({ error: "Invalid user token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: profile } = await adminClient.from("users").select("role").eq("user_id", user.id).maybeSingle();
    if (!profile) {
      return new Response(JSON.stringify({ error: "User profile not found" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const role = profile.role;
    const isAdmin = role === "admin" || role === "super_admin";
    const isSuperAdmin = role === "super_admin";

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.errors[0].message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { action } = parsed.data;

    if (action === "list") {
      const { page, limit, is_read, tipe, user_id, from_date, to_date } = parsed.data;
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      let query = adminClient
        .from("notifikasi")
        .select(`
          *,
          user:user_id ( user_id, email, name, role )
        `, { count: "exact" });

      if (is_read !== undefined) query = query.eq("is_read", is_read);
      if (tipe !== undefined) query = query.eq("tipe", tipe);
      if (user_id !== undefined) query = query.eq("user_id", user_id);
      if (!isAdmin && user_id === undefined) query = query.eq("user_id", user.id);
      if (from_date) query = query.gte("created_at", from_date);
      if (to_date) query = query.lte("created_at", to_date);

      const { data: notifications, count, error } = await query.order("created_at", { ascending: false }).range(from, to);
      if (error) throw error;

      const total = count ?? 0;
      return new Response(JSON.stringify({
        notifications: notifications || [],
        pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "mark-read") {
      const ids = Array.isArray(parsed.data.notifikasi_id) ? parsed.data.notifikasi_id : [parsed.data.notifikasi_id];

      const { error } = await adminClient.from("notifikasi").update({ is_read: true }).in("notifikasi_id", ids);
      if (error) throw error;

      return new Response(JSON.stringify({ message: `${ids.length} notification(s) marked as read` }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "mark-all-read") {
      let query = adminClient.from("notifikasi").update({ is_read: true });

      if (parsed.data.user_id) {
        query = query.eq("user_id", parsed.data.user_id);
      } else if (!isSuperAdmin) {
        query = query.eq("user_id", user.id);
      }

      const { error } = await query;
      if (error) throw error;

      return new Response(JSON.stringify({ message: "All notifications marked as read" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "stats") {
      const baseFilter = isAdmin ? {} : { user_id: user.id } as Record<string, any>;
      const [totalResult, unreadResult, typeResult] = await Promise.all([
        adminClient.from("notifikasi").select("*", { count: "exact", head: true }).match(baseFilter),
        adminClient.from("notifikasi").select("*", { count: "exact", head: true }).match({ ...baseFilter, is_read: false }),
        adminClient.from("notifikasi").select("tipe").match(baseFilter),
      ]);

      if (totalResult.error) throw totalResult.error;
      if (unreadResult.error) throw unreadResult.error;
      if (typeResult.error) throw typeResult.error;

      const byType: Record<string, number> = {};
      for (const n of typeResult.data || []) {
        byType[n.tipe] = (byType[n.tipe] || 0) + 1;
      }

      return new Response(JSON.stringify({
        total: totalResult.count ?? 0,
        unread: unreadResult.count ?? 0,
        by_type: byType,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
