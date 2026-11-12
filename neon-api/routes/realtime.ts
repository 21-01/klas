import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import { createRealtime, rawSql } from "@neon/realtime/server";
import { env } from "../lib/env.ts";
import { badRequest, corsHeaders, HttpError } from "../lib/http.ts";
import { assertSessionAccess, currentUser } from "../lib/auth.ts";

const app = new Hono();

// ---------------------------------------------------------------------------
// Live-query capabilities
// ---------------------------------------------------------------------------

interface PresensiLiveRow {
  presensi_id: string;
  sesi_id: string;
  mahasiswa_id: string;
  status: string;
  metode: string | null;
  waktu_check_in: string;
  geofence_flagged: boolean;
  nim: string;
  nama: string;
}

interface SesiLiveRow {
  sesi_id: string;
  status: string;
  tanggal: string;
  waktu_mulai: string;
  waktu_selesai: string | null;
  geofence_radius_m: number;
  qr_rotates_every: number;
}

interface NotifikasiLiveRow {
  notifikasi_id: string;
  user_id: string;
  tipe: string;
  judul: string;
  pesan: string | null;
  is_read: boolean;
  created_at: string;
}

/** Path segment of the PostgreSQL connection string, falling back to `neondb`. */
function databaseName(url: string): string {
  try {
    const parsed = new URL(url);
    const name = parsed.pathname.split("/").filter(Boolean)[0];
    return name ? decodeURIComponent(name) : "neondb";
  } catch {
    return "neondb";
  }
}

/**
 * Server-only capability issuer.
 * Created lazily: a missing/invalid secret must not fail module load (that would
 * take down every route, not just Realtime).
 */
let realtimeClient: ReturnType<typeof createRealtime> | null = null;

function getRealtime() {
  if (realtimeClient) return realtimeClient;
  const secret = process.env.NEON_REALTIME_SECRET;
  if (!secret) throw new HttpError(503, "Neon Realtime is not configured (NEON_REALTIME_SECRET)");
  realtimeClient = createRealtime({ secret, db: databaseName(env.databaseUrl) });
  return realtimeClient;
}

/** Public Realtime client configuration (never includes the secret). */
export function realtimeInfo(): { url: string } {
  return { url: process.env.NEON_REALTIME_URL ?? "" };
}

/** Reads and validates a JSON body, surfacing validation errors as 400s. */
async function readBody(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    throw badRequest("Invalid JSON body");
  }
}

function parseBody<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw badRequest(result.error.issues[0]?.message ?? "Invalid request body");
  }
  return result.data;
}

const sessionBody = z.object({ sesi_id: z.uuid() });

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.get("/realtime/config", (c) => c.json(realtimeInfo(), 200, corsHeaders(c)));

app.post("/realtime/presensi", async (c) => {
  const user = await currentUser(c);
  const { sesi_id } = parseBody(sessionBody, await readBody(c));

  // Admins or the owning lecturer only.
  await assertSessionAccess(user, sesi_id);

  const query = rawSql<PresensiLiveRow>(
    `select p.presensi_id, p.sesi_id, p.mahasiswa_id, p.status, p.metode,
            p.waktu_check_in, p.geofence_flagged, m.nim, m.nama
       from presensi p
       join mahasiswa m on m.mahasiswa_id = p.mahasiswa_id
      where p.sesi_id = $1
      order by p.waktu_check_in desc`,
    [sesi_id],
  );

  const sealed = await getRealtime().seal({ query });
  return c.json(sealed as object, 200, corsHeaders(c));
});

app.post("/realtime/sesi", async (c) => {
  const user = await currentUser(c);
  const { sesi_id } = parseBody(sessionBody, await readBody(c));

  await assertSessionAccess(user, sesi_id);

  const query = rawSql<SesiLiveRow>(
    `select sesi_id, status, tanggal, waktu_mulai, waktu_selesai,
            geofence_radius_m, qr_rotates_every
       from sesi_kehadiran
      where sesi_id = $1`,
    [sesi_id],
  );

  const sealed = await getRealtime().seal({ query });
  return c.json(sealed as object, 200, corsHeaders(c));
});

app.post("/realtime/notifikasi", async (c) => {
  const user = await currentUser(c);

  // Always scoped to the caller; a body-supplied user_id is never accepted.
  const query = rawSql<NotifikasiLiveRow>(
    `select notifikasi_id, user_id, tipe, judul, pesan, is_read, created_at
       from notifikasi
      where user_id = $1
      order by created_at desc
      limit 50`,
    [user.userId],
  );

  const sealed = await getRealtime().seal({ query });
  return c.json(sealed as object, 200, corsHeaders(c));
});

export default app;
