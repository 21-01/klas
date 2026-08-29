import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getAdminClient, extractJwt, getClientIp } from "../_shared/supabase.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const createSchema = z.object({
  kode_prodi: z.string().max(20).min(1, "kode_prodi is required"),
  nama_prodi: z.string().max(150).min(1, "nama_prodi is required"),
});

const updateSchema = z.object({
  prodi_id: z.number().int().positive(),
  kode_prodi: z.string().max(20).optional(),
  nama_prodi: z.string().max(150).optional(),
});

const getSchema = z.object({
  prodi_id: z.number().int().positive(),
});

const deleteSchema = z.object({
  prodi_id: z.number().int().positive(),
});

const listSchema = z.object({
  search: z.string().optional(),
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
      return new Response(JSON.stringify({ error: "Access denied: Admin role required" }), {
        status: 403,
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
    const { action, ...payload } = body;

    if (!action || typeof action !== "string") {
      return new Response(JSON.stringify({ error: "Missing or invalid 'action' field" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    switch (action) {
      case "list": {
        const parsed = listSchema.safeParse(payload);
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: parsed.error.errors.map((e) => e.message).join("; ") }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const search = parsed.data.search?.trim() || "";
        let query = adminClient.from("program_studi").select("*").order("nama_prodi", { ascending: true });

        if (search) {
          query = query.or(`kode_prodi.ilike.%${search}%,nama_prodi.ilike.%${search}%`);
        }

        const { data, error } = await query;
        if (error) throw new Error(error.message);

        return new Response(JSON.stringify({ data }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get": {
        const parsed = getSchema.safeParse(payload);
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: parsed.error.errors.map((e) => e.message).join("; ") }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data, error } = await adminClient
          .from("program_studi")
          .select("*")
          .eq("prodi_id", parsed.data.prodi_id)
          .maybeSingle();

        if (error) throw new Error(error.message);
        if (!data) {
          return new Response(JSON.stringify({ error: "Program studi not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ data }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "create": {
        const parsed = createSchema.safeParse(payload);
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: parsed.error.errors.map((e) => e.message).join("; ") }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data, error } = await adminClient
          .from("program_studi")
          .insert({
            kode_prodi: parsed.data.kode_prodi,
            nama_prodi: parsed.data.nama_prodi,
          })
          .select("*")
          .single();

        if (error) {
          if (error.code === "23505") {
            return new Response(JSON.stringify({ error: "Kode prodi already exists" }), {
              status: 409,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          throw new Error(error.message);
        }

        await adminClient.from("audit_log").insert({
          kategori: "Master Data",
          aksi: `Created program studi: ${parsed.data.kode_prodi} - ${parsed.data.nama_prodi}`,
          ip_address: clientIp,
          user_id: caller.id,
          status: "success",
        });

        return new Response(JSON.stringify({ message: "Program studi created", data }), {
          status: 201,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "update": {
        const parsed = updateSchema.safeParse(payload);
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: parsed.error.errors.map((e) => e.message).join("; ") }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { prodi_id, ...fields } = parsed.data;
        if (Object.keys(fields).length === 0) {
          return new Response(JSON.stringify({ error: "No fields to update" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data, error } = await adminClient
          .from("program_studi")
          .update(fields)
          .eq("prodi_id", prodi_id)
          .select("*")
          .single();

        if (error) {
          if (error.code === "23505") {
            return new Response(JSON.stringify({ error: "Kode prodi already exists" }), {
              status: 409,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          throw new Error(error.message);
        }

        if (!data) {
          return new Response(JSON.stringify({ error: "Program studi not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        await adminClient.from("audit_log").insert({
          kategori: "Master Data",
          aksi: `Updated program studi (ID: ${prodi_id})`,
          ip_address: clientIp,
          user_id: caller.id,
          status: "success",
        });

        return new Response(JSON.stringify({ message: "Program studi updated", data }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "delete": {
        const parsed = deleteSchema.safeParse(payload);
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: parsed.error.errors.map((e) => e.message).join("; ") }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { prodi_id } = parsed.data;

        const [
          { count: mhsCount, error: mhsErr },
          { count: dosenCount, error: dosenErr },
          { count: mkCount, error: mkErr },
        ] = await Promise.all([
          adminClient.from("mahasiswa").select("*", { count: "exact", head: true }).eq("prodi_id", prodi_id),
          adminClient.from("dosen").select("*", { count: "exact", head: true }).eq("prodi_id", prodi_id),
          adminClient.from("mata_kuliah").select("*", { count: "exact", head: true }).eq("prodi_id", prodi_id),
        ]);

        if (mhsErr) throw new Error(mhsErr.message);
        if (dosenErr) throw new Error(dosenErr.message);
        if (mkErr) throw new Error(mkErr.message);

        const dependents: string[] = [];
        if (mhsCount && mhsCount > 0) dependents.push(`${mhsCount} mahasiswa`);
        if (dosenCount && dosenCount > 0) dependents.push(`${dosenCount} dosen`);
        if (mkCount && mkCount > 0) dependents.push(`${mkCount} mata kuliah`);

        if (dependents.length > 0) {
          return new Response(JSON.stringify({
            error: `Cannot delete: program studi still has ${dependents.join(", ")}`,
          }), {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error: delError } = await adminClient
          .from("program_studi")
          .delete()
          .eq("prodi_id", prodi_id);

        if (delError) throw new Error(delError.message);

        await adminClient.from("audit_log").insert({
          kategori: "Master Data",
          aksi: `Deleted program studi (ID: ${prodi_id})`,
          ip_address: clientIp,
          user_id: caller.id,
          status: "success",
        });

        return new Response(JSON.stringify({ message: "Program studi deleted" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
