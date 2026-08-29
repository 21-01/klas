import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getAdminClient, extractJwt, getClientIp } from "../_shared/supabase.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const updateProfileSchema = z.object({
  nama: z.string().min(1, "Name is required").optional(),
  jenis_kelamin: z.enum(["L", "P"]).optional(),
});

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

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.errors[0].message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: dsn } = await adminClient
      .from("dosen")
      .select("dosen_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!dsn) {
      return new Response(JSON.stringify({ error: "Dosen profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const updates: Record<string, unknown> = {};
    if (parsed.data.nama !== undefined) updates.nama = parsed.data.nama;
    if (parsed.data.jenis_kelamin !== undefined) updates.jenis_kelamin = parsed.data.jenis_kelamin;

    if (Object.keys(updates).length === 0) {
      return new Response(JSON.stringify({ error: "No fields to update" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: updateError } = await adminClient
      .from("dosen")
      .update(updates)
      .eq("dosen_id", dsn.dosen_id);

    if (updateError) throw updateError;

    if (parsed.data.nama) {
      await adminClient.auth.admin.updateUserById(user.id, {
        user_metadata: { name: parsed.data.nama },
      });
    }

    await adminClient.from("audit_log").insert({
      kategori: "Master Data",
      aksi: `Dosen profile updated: ${Object.keys(updates).join(", ")}`,
      ip_address: clientIp,
      user_id: user.id,
      status: "success",
    });

    return new Response(
      JSON.stringify({ message: "Profile updated successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
