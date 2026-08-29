import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getAdminClient, getClientIp } from "../_shared/supabase.ts";
import { loginSchema } from "../_shared/zod-schemas.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const adminClient = getAdminClient();
  const clientIp = getClientIp(req);

  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.errors[0].message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, password } = parsed.data;

    // 1. Brute-force check: atomic check-and-record via RPC
    let failedCount = 0;
    let isBlocked = false;
    try {
      const { data: rateLimitResult } = await adminClient.rpc("check_and_record_failed_login", {
        p_ip_address: clientIp,
        p_email: email,
        p_window_seconds: 60,
        p_max_attempts: 5,
      });
      if (rateLimitResult) {
        isBlocked = rateLimitResult.blocked;
        failedCount = rateLimitResult.attempt_count;
      }
    } catch {
      // RPC may not exist yet — degrade gracefully
      console.warn("check_and_record_failed_login RPC not available, brute-force protection disabled");
    }

    if (isBlocked) {
      try {
        await adminClient.from("notifikasi").insert({
          tipe: "brute_force",
          judul: "Brute Force Warning",
          pesan: `>5 failed login attempts from IP ${clientIp} in the last 1 minute.`,
          user_id: "00000000-0000-0000-0000-000000000001",
        });
      } catch {
        console.warn("Could not insert brute force warning into notifikasi");
      }

      await adminClient.from("audit_log").insert({
        kategori: "Security Policies",
        aksi: `IP ${clientIp} blocked due to too many failed login attempts. Tried email: ${email}`,
        ip_address: clientIp,
        status: "failed",
      });

      return new Response(
        JSON.stringify({ error: "Terlalu banyak percobaan masuk yang gagal. Silakan coba lagi dalam 1 menit." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Authenticate
    const { data: authData, error: authError } = await adminClient.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user || !authData.session) {
      // RPC already recorded the failed attempt above
      await adminClient.from("audit_log").insert({
        kategori: "Authentication",
        aksi: `Failed login attempt for email: ${email}. Error: ${authError?.message || "Invalid credentials"}`,
        ip_address: clientIp,
        status: "failed",
      });

      if (failedCount >= 5) {
        try {
          await adminClient.from("notifikasi").insert({
            tipe: "brute_force",
            judul: "Brute Force Warning",
            pesan: `IP ${clientIp} has reached the limit of 5 failed login attempts.`,
            user_id: "00000000-0000-0000-0000-000000000001",
          });
        } catch { /* table may not exist */ }
      }

      return new Response(JSON.stringify({ error: authError?.message || "Invalid login credentials" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Success — clean up failed attempts for this IP
    try {
      await adminClient.from("failed_login_attempts").delete().eq("ip_address", clientIp);
    } catch { /* table may not exist */ }

    // 4. Retrieve user profile
    const { data: profile } = await adminClient
      .from("users")
      .select("role, name")
      .eq("user_id", authData.user.id)
      .maybeSingle();

    const userRole = profile?.role || authData.user.user_metadata?.role || "mahasiswa";

    await adminClient.from("audit_log").insert({
      kategori: "Authentication",
      aksi: `Successful login for user ${email} (Role: ${userRole})`,
      ip_address: clientIp,
      user_id: authData.user.id,
      status: "success",
    });

    return new Response(
      JSON.stringify({
        session: {
          access_token: authData.session.access_token,
          refresh_token: authData.session.refresh_token,
          expires_at: authData.session.expires_at,
        },
        user: {
          id: authData.user.id,
          email: authData.user.email,
          name: profile?.name || authData.user.user_metadata?.name || "",
          role: userRole,
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
