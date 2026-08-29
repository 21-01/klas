import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getAdminClient, getClientIp } from "../_shared/supabase.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const refreshSessionSchema = z.object({
  refresh_token: z.string().min(1, "Refresh token is required"),
});

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const adminClient = getAdminClient();
  const clientIp = getClientIp(req);

  try {
    const body = await req.json();
    const parsed = refreshSessionSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.errors[0].message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { refresh_token } = parsed.data;

    const { data, error } = await adminClient.auth.refreshSession({ refresh_token });

    if (error || !data.session) {
      await adminClient.from("audit_log").insert({
        kategori: "Authentication",
        aksi: `Failed session refresh attempt from IP ${clientIp}: ${error?.message}`,
        ip_address: clientIp,
        status: "failed",
      });

      return new Response(JSON.stringify({ error: error?.message || "Invalid refresh token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await adminClient
      .from("users")
      .select("role, name")
      .eq("user_id", data.user.id)
      .maybeSingle();

    return new Response(
      JSON.stringify({
        session: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at,
        },
        user: {
          id: data.user.id,
          email: data.user.email,
          name: profile?.name || data.user.user_metadata?.name || "",
          role: profile?.role || data.user.user_metadata?.role || "mahasiswa",
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
