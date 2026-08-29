import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getAdminClient, extractJwt, getClientIp } from "../_shared/supabase.ts";
import { provisionUserSchema } from "../_shared/zod-schemas.ts";

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
    // 1. Authenticate caller and verify admin role
    const { data: { user: caller }, error: callerError } = await adminClient.auth.getUser(jwt);
    if (callerError || !caller) {
      return new Response(JSON.stringify({ error: "Invalid user token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callerProfile } = await adminClient
      .from("users")
      .select("role")
      .eq("user_id", caller.id)
      .maybeSingle();

    const callerRole = callerProfile?.role || caller.user_metadata?.role || "";
    const isAdmin = callerRole === "admin" || callerRole === "super_admin" || callerRole === "admin_prodi";

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Access denied: Admin Prodi role required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Parse and validate request
    const body = await req.json();
    const parsed = provisionUserSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.errors.map((e) => e.message).join("; ") }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, password, name, role, identifier, prodi_id } = parsed.data;

    // 3. Provision user in Supabase Auth
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role },
    });

    if (authError || !authData.user) {
      return new Response(
        JSON.stringify({ error: `Auth provisioning failed: ${authError?.message || "Unknown error"}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const newUserId = authData.user.id;

    // 4. Create user profile
    const { error: userInsertError } = await adminClient.from("users").insert({
      user_id: newUserId,
      name,
      email,
      role,
    });

    if (userInsertError) {
      await adminClient.auth.admin.deleteUser(newUserId);
      throw new Error(`Failed to create database user profile: ${userInsertError.message}`);
    }

    // 5. Create role-specific sub-table entry
    if (role === "mahasiswa") {
      const { error: mhsError } = await adminClient.from("mahasiswa").insert({
        nim: identifier,
        nama: name,
        user_id: newUserId,
        prodi_id,
      });

      if (mhsError) {
        await adminClient.from("users").delete().eq("user_id", newUserId);
        await adminClient.auth.admin.deleteUser(newUserId);
        throw new Error(`Failed to create Mahasiswa profile: ${mhsError.message}`);
      }
    } else if (role === "dosen") {
      const { error: dosenError } = await adminClient.from("dosen").insert({
        nip: identifier,
        nama: name,
        user_id: newUserId,
        prodi_id,
      });

      if (dosenError) {
        await adminClient.from("users").delete().eq("user_id", newUserId);
        await adminClient.auth.admin.deleteUser(newUserId);
        throw new Error(`Failed to create Dosen profile: ${dosenError.message}`);
    }
    }

    // 6. Log to audit
    await adminClient.from("audit_log").insert({
      kategori: "Master Data",
      aksi: `Provisioned user ${email} (${role}) with identifier ${identifier}`,
      ip_address: clientIp,
      user_id: caller.id,
      status: "success",
    });

    return new Response(
      JSON.stringify({
        message: `Account for ${name} provisioned successfully`,
        user_id: newUserId,
        role,
        identifier,
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
