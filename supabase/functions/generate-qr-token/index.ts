import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getAdminClient, extractJwt } from "../_shared/supabase.ts";
import { encryptToken } from "../_shared/crypto.ts";
import { generateQrTokenSchema } from "../_shared/zod-schemas.ts";

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
  const qrSecret = Deno.env.get("QR_SECRET");
  if (!qrSecret) {
    return new Response(JSON.stringify({ error: "QR_SECRET not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { data: { user }, error: userError } = await adminClient.auth.getUser(jwt);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid user token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Verify dosen or admin
    const { data: dosen } = await adminClient
      .from("dosen")
      .select("dosen_id, nip")
      .eq("user_id", user.id)
      .maybeSingle();

    const { data: userProfile } = await adminClient
      .from("users")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    const isAdmin = userProfile?.role === "admin" || userProfile?.role === "super_admin" || userProfile?.role === "admin_prodi";

    if (!dosen && !isAdmin) {
      return new Response(JSON.stringify({ error: "Access denied: Lecturer or Admin role required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Parse request
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const parsed = generateQrTokenSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.errors[0].message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { sesi_id, ttl_seconds, covers } = parsed.data!;

    // 3. Verify session exists and is live
    const { data: session, error: sessionError } = await adminClient
      .from("sesi_kehadiran")
      .select("sesi_id, status, jadwal_id, jadwal_kelas!inner(dosen_id)")
      .eq("sesi_id", sesi_id)
      .single();

    if (sessionError || !session) {
      return new Response(JSON.stringify({ error: "Class session not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (session.status !== "live") {
      return new Response(JSON.stringify({ error: "Cannot generate QR code: session is not live" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Verify dosen ownership (if not admin)
    if (!isAdmin && dosen) {
      const lecturerId = session.jadwal_kelas?.dosen_id;
      if (lecturerId && lecturerId !== dosen.dosen_id) {
        return new Response(JSON.stringify({ error: "Access denied: You are not the lecturer for this class" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 5. Generate batch of encrypted tokens
    const count = Math.ceil((covers * 60) / ttl_seconds);
    const tokens: Array<{ qr_token: string; expired_at: string }> = [];
    const qrRows: Array<{ sesi_id: string; token: string; expired_at: string }> = [];

    for (let i = 0; i < count; i++) {
      const saltArray = new Uint8Array(16);
      crypto.getRandomValues(saltArray);
      const securitySaltToken = btoa(String.fromCharCode(...saltArray)).slice(0, 16);

      const tokenTimestamp = new Date(Date.now() + i * ttl_seconds * 1000);
      const payload = JSON.stringify({
        sesi_id,
        server_timestamp: tokenTimestamp.toISOString(),
        security_salt_token: securitySaltToken,
      });

      const qrToken = await encryptToken(payload, qrSecret);
      const expiredAt = new Date(tokenTimestamp.getTime() + ttl_seconds * 1000).toISOString();

      tokens.push({ qr_token: qrToken, expired_at: expiredAt });
      qrRows.push({ sesi_id, token: qrToken, expired_at: expiredAt });
    }

    // 6. Batch store in qr_code
    const { error: qrError } = await adminClient.from("qr_code").insert(qrRows);
    if (qrError) throw qrError;

    return new Response(
      JSON.stringify({ tokens, ttl_seconds }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
