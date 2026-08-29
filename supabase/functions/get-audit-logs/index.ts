import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getAdminClient, extractJwt } from "../_shared/supabase.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const KATEGORI = [
  "Master Data",
  "Schedule Plotting",
  "Security Policies",
  "Attendance Overrides",
  "Authentication",
  "Geofence",
  "System",
] as const;

const FilterSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  kategori: z.enum(KATEGORI).optional(),
  status: z.enum(["success", "failed"]).optional(),
  search: z.string().optional(),
  from_date: z.string().optional(),
  to_date: z.string().optional(),
  user_id: z.string().uuid().optional(),
  format: z.enum(["json", "csv"]).default("json"),
});

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = getAdminClient();
    const jwt = extractJwt(authHeader);

    const { data: { user }, error: userError } = await adminClient.auth.getUser(jwt);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid user token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await adminClient
      .from("users")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile || profile.role !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 403,
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
    const parsed = FilterSchema.parse(body);

    const { page, limit, kategori, status, search, from_date, to_date, user_id, format } = parsed;

    if (format === "csv") {
      let csvQuery = adminClient
        .from("audit_log")
        .select(`
          log_id, timestamp, kategori, aksi, ip_address, status,
          users:user_id (name, email)
        `)
        .order("timestamp", { ascending: false });

      if (kategori) csvQuery = csvQuery.eq("kategori", kategori);
      if (status) csvQuery = csvQuery.eq("status", status);
      if (search) csvQuery = csvQuery.ilike("aksi", `%${search}%`);
      if (from_date) csvQuery = csvQuery.gte("timestamp", from_date);
      if (to_date) csvQuery = csvQuery.lte("timestamp", to_date);
      if (user_id) csvQuery = csvQuery.eq("user_id", user_id);

      const { data: logs, error } = await csvQuery;
      if (error) throw error;

      const header = "Timestamp,User,Email,Kategori,Aksi,IP Address,Status";
      const rows = (logs ?? []).map((log: Record<string, unknown>) => {
        const u = (log.users as Record<string, string> | null) ?? {};
        return [
          `"${log.timestamp ?? ""}"`,
          `"${(u.name ?? "")}"`,
          `"${(u.email ?? "")}"`,
          `"${log.kategori ?? ""}"`,
          `"${(log.aksi ?? "").replace(/"/g, '""')}"`,
          `"${log.ip_address ?? ""}"`,
          `"${log.status ?? ""}"`,
        ].join(",");
      });

      const csv = [header, ...rows].join("\n");

      return new Response(csv, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="audit-logs-${Date.now()}.csv"`,
        },
      });
    }

    const countQuery = adminClient
      .from("audit_log")
      .select("log_id", { count: "exact", head: true });

    if (kategori) countQuery.eq("kategori", kategori);
    if (status) countQuery.eq("status", status);
    if (search) countQuery.ilike("aksi", `%${search}%`);
    if (from_date) countQuery.gte("timestamp", from_date);
    if (to_date) countQuery.lte("timestamp", to_date);
    if (user_id) countQuery.eq("user_id", user_id);

    const { count: total, error: countError } = await countQuery;
    if (countError) throw countError;

    const totalPages = Math.ceil((total ?? 0) / limit);
    const offset = (page - 1) * limit;

    let dataQuery = adminClient
      .from("audit_log")
      .select(`
        log_id, user_id, timestamp, kategori, aksi, ip_address, status, metadata, created_at,
        users:user_id (name, email)
      `)
      .order("timestamp", { ascending: false })
      .range(offset, offset + limit - 1);

    if (kategori) dataQuery = dataQuery.eq("kategori", kategori);
    if (status) dataQuery = dataQuery.eq("status", status);
    if (search) dataQuery = dataQuery.ilike("aksi", `%${search}%`);
    if (from_date) dataQuery = dataQuery.gte("timestamp", from_date);
    if (to_date) dataQuery = dataQuery.lte("timestamp", to_date);
    if (user_id) dataQuery = dataQuery.eq("user_id", user_id);

    const { data: logs, error: dataError } = await dataQuery;
    if (dataError) throw dataError;

    return new Response(
      JSON.stringify({
        logs: logs ?? [],
        pagination: { page, limit, total: total ?? 0, total_pages: totalPages },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    const message = err instanceof z.ZodError
      ? err.errors.map((e) => `${e.path.join(".")}: ${e.message}`)
      : err instanceof Error
      ? err.message
      : "Internal server error";

    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
