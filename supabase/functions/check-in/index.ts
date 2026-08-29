import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getAdminClient, extractJwt, getClientIp } from "../_shared/supabase.ts";
import { decryptToken } from "../_shared/crypto.ts";
import { getDistanceMeters, isIpInSubnet } from "../_shared/geofence.ts";
import { checkInSchema } from "../_shared/zod-schemas.ts";

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
  const qrSecret = Deno.env.get("QR_SECRET");
  if (!qrSecret) {
    return new Response(JSON.stringify({ error: "QR_SECRET not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // 1. Authenticate user
    const { data: { user }, error: userError } = await adminClient.auth.getUser(jwt);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid user token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Get mahasiswa profile
    const { data: mahasiswa, error: mhsError } = await adminClient
      .from("mahasiswa")
      .select("mahasiswa_id, nim")
      .eq("user_id", user.id)
      .single();

    if (mhsError || !mahasiswa) {
      return new Response(JSON.stringify({ error: "Mahasiswa profile not found" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Parse & validate request
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const parsed = checkInSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.errors[0].message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { qr_token, latitude, longitude } = parsed.data;

    // 4. Decrypt QR token
    let decryptedPayload: string;
    try {
      decryptedPayload = await decryptToken(qr_token, qrSecret);
    } catch {
      await adminClient.from("audit_log").insert({
        kategori: "Security Policies",
        aksi: "Failed check-in: invalid or tampered QR token payload",
        ip_address: clientIp,
        user_id: user.id,
        status: "failed",
      });
      return new Response(JSON.stringify({ error: "Invalid QR code token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { sesi_id, server_timestamp } = JSON.parse(decryptedPayload);

    // 5. Get session & room details
    const { data: session, error: sessionError } = await adminClient
      .from("sesi_kehadiran")
      .select(`
        sesi_id, status, jadwal_id, qr_rotates_every,
        jadwal_kelas!inner(
          jadwal_id,
          ruangan_id,
          ruangan!inner(
            ruangan_id, nama_ruangan, latitude, longitude, geofence_radius_m
          )
        )
      `)
      .eq("sesi_id", sesi_id)
      .single();

    if (sessionError || !session) {
      return new Response(JSON.stringify({ error: "Class session not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (session.status !== "live") {
      return new Response(JSON.stringify({ error: "Sesi kelas tidak aktif" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 6. Validate TTL using session's qr_rotates_every (with 5s buffer for scan latency)
    const ttlSeconds = (session.qr_rotates_every || 15) + 5;
    const ageSeconds = Math.abs(Date.now() - new Date(server_timestamp).getTime()) / 1000;
    if (ageSeconds > ttlSeconds) {
      await adminClient.from("audit_log").insert({
        kategori: "Security Policies",
        aksi: `Failed check-in: QR code expired. Token age: ${ageSeconds.toFixed(1)}s, TTL: ${ttlSeconds}s`,
        ip_address: clientIp,
        user_id: user.id,
        status: "failed",
      });
      return new Response(JSON.stringify({ error: "QR code has expired" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ruang = session.jadwal_kelas?.ruangan;
    if (!ruang || ruang.latitude === null || ruang.longitude === null) {
      return new Response(JSON.stringify({ error: "Classroom coordinates not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 7. Geofence check
    const distance = getDistanceMeters(latitude, longitude, Number(ruang.latitude), Number(ruang.longitude));
    const configuredRadius = ruang.geofence_radius_m || 50;
    const geofenceFlagged = distance > configuredRadius;

    // 8. IP whitelist check
    const { data: ipWhitelistRows } = await adminClient
      .from("ip_whitelist")
      .select("cidr");

    const whitelistedSubnets: string[] = ["127.0.0.1/32"];
    if (ipWhitelistRows && ipWhitelistRows.length > 0) {
      whitelistedSubnets.push(...ipWhitelistRows.map((r) => r.cidr));
    }
    whitelistedSubnets.push("192.168.0.0/16", "10.0.0.0/8", "172.16.0.0/12");

    const ipMatch = whitelistedSubnets.some((subnet) => isIpInSubnet(clientIp, subnet));
    if (!ipMatch) {
      await adminClient.from("audit_log").insert({
        kategori: "Security Policies",
        aksi: `Network violation: Client IP ${clientIp} not in whitelist subnets`,
        ip_address: clientIp,
        user_id: user.id,
        status: "failed",
      });
      return new Response(JSON.stringify({ error: "Harap gunakan koneksi Wi-Fi Kampus" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 9. Insert presensi (unique constraint on sesi_id+mahasiswa_id prevents duplicates)
    const { error: insertError } = await adminClient.from("presensi").insert({
      mahasiswa_id: mahasiswa.mahasiswa_id,
      sesi_id,
      waktu_check_in: new Date().toISOString(),
      status: geofenceFlagged ? "late" : "present",
      latitude,
      longitude,
      ip_address: clientIp,
      metode: "qr",
      geofence_delta_m: Math.round(distance * 100) / 100,
      geofence_flagged: geofenceFlagged,
    });

    if (insertError) {
      // PostgreSQL unique violation error code
      if (insertError.code === "23505") {
        return new Response(JSON.stringify({ error: "Anda sudah melakukan check-in untuk sesi ini" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw insertError;
    }

    // 11. Log success
    await adminClient.from("audit_log").insert({
      kategori: "Attendance Overrides",
      aksi: `Successful check-in for Mahasiswa NIM ${mahasiswa.nim} in Room ${ruang.nama_ruangan}`,
      ip_address: clientIp,
      user_id: user.id,
      status: "success",
    });

    return new Response(
      JSON.stringify({
        message: "Attendance verified successfully",
        status: geofenceFlagged ? "late" : "present",
        room: ruang.nama_ruangan,
        distance: `${distance.toFixed(1)}m`,
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
