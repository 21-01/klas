import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getAdminClient, getUserClient, extractJwt } from "../_shared/supabase.ts";

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

  try {
    const { data: { user }, error: userError } = await adminClient.auth.getUser(jwt);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid user token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = getUserClient(jwt!);

    const { data: dsn, error: dsnError } = await userClient
      .from("dosen")
      .select(`
        dosen_id, nip, nidn, nama, jenis_kelamin, prodi_id,
        program_studi!inner(kode_prodi, nama_prodi)
      `)
      .eq("user_id", user.id)
      .maybeSingle();

    if (dsnError || !dsn) {
      return new Response(JSON.stringify({ error: "Dosen profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        dosen_id: dsn.dosen_id,
        nip: dsn.nip,
        nidn: dsn.nidn,
        nama: dsn.nama,
        jenis_kelamin: dsn.jenis_kelamin,
        prodi: dsn.program_studi,
        email: user.email,
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
