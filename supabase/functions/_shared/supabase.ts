import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders } from "./cors.ts";

export function getAdminClient() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}

export function getUserClient(token: string) {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_ANON_KEY")!;
  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

export function extractJwt(authHeader: string): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

export function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("CF-Connecting-IP")?.trim() ||
    "127.0.0.1"
  );
}

export async function requireRole(
  adminClient: ReturnType<typeof getAdminClient>,
  jwt: string | null,
  allowedRoles: string[]
): Promise<{ user: { id: string; email?: string }; profile: { role: string; name: string } } | Response> {
  const { data: { user }, error: userError } = await adminClient.auth.getUser(jwt);
  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Invalid user token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: profile } = await adminClient
    .from("users")
    .select("role, name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile || !allowedRoles.includes(profile.role)) {
    return new Response(JSON.stringify({ error: "Access denied" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return { user, profile };
}
