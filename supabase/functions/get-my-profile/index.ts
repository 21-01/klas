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

    const { data: roleRow } = await adminClient
      .from("users")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    const role = roleRow?.role ?? user.user_metadata?.role ?? "mahasiswa";

    const userClient = getUserClient(jwt!);

    if (role === "dosen") {
      const { data: dsn, error: dsnError } = await userClient
        .from("dosen")
        .select("dosen_id, nip, nama, jenis_kelamin")
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
          user_id: user.id,
          email: user.email,
          role,
          nama: dsn.nama,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (role === "admin" || role === "super_admin" || role === "admin_prodi") {
      return new Response(
        JSON.stringify({
          user_id: user.id,
          email: user.email,
          role,
          name: user.user_metadata?.name ?? user.email,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: mhs, error: mhsError } = await userClient
      .from("mahasiswa")
      .select(`
        mahasiswa_id, nim, nama, angkatan, jenis_kelamin, gpa, pembimbing_akademik,
        program_studi!inner(kode_prodi, nama_prodi)
      `)
      .eq("user_id", user.id)
      .maybeSingle();

    if (mhsError || !mhs) {
      return new Response(JSON.stringify({ error: "Mahasiswa profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        user_id: user.id,
        email: user.email,
        role,
        nim: mhs.nim,
        nama: mhs.nama,
        angkatan: mhs.angkatan,
        jenis_kelamin: mhs.jenis_kelamin,
        gpa: mhs.gpa,
        pembimbing_akademik: mhs.pembimbing_akademik,
        prodi: mhs.program_studi,
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
