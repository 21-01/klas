import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getAdminClient, extractJwt, getClientIp } from "../_shared/supabase.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const changePasswordSchema = z.object({
  current_password: z.string().min(1, "Current password is required"),
  new_password: z.string().min(8, "New password must be at least 8 characters"),
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

    const body = await req.json();
    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.errors[0].message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { current_password, new_password } = parsed.data;

    // 1. Re-authenticate with current password to verify identity
    const { error: signInError } = await adminClient.auth.signInWithPassword({
      email: user.email!,
      password: current_password,
    });

    if (signInError) {
      await adminClient.from("audit_log").insert({
        kategori: "Authentication",
        aksi: `Failed password change attempt for user ${user.email}`,
        ip_address: clientIp,
        user_id: user.id,
        status: "failed",
      });

      return new Response(JSON.stringify({ error: "Current password is incorrect" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Update password
    const { error: updateError } = await adminClient.auth.admin.updateUserById(user.id, {
      password: new_password,
    });

    if (updateError) {
      return new Response(JSON.stringify({ error: `Failed to update password: ${updateError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await adminClient.from("audit_log").insert({
      kategori: "Authentication",
      aksi: `Password changed successfully for user ${user.email}`,
      ip_address: clientIp,
      user_id: user.id,
      status: "success",
    });

    return new Response(
      JSON.stringify({ message: "Password changed successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
