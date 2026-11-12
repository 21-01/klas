import { Hono, type Context } from "hono";
import { z } from "zod";
import { uuid } from "../lib/ids.ts";
import { one, many, run, transaction, isUniqueViolation } from "../lib/db.ts";
import {
  HttpError,
  badRequest,
  conflict,
  forbidden,
  notFound,
  ok,
} from "../lib/http.ts";
import {
  currentUser,
  requireRole,
  assertSessionAccess,
  assertJadwalAccess,
  getClientIp,
} from "../lib/auth.ts";
import {
  getDistanceMeters,
  isIpInSubnet,
  DEFAULT_IP_WHITELIST,
} from "../lib/geo.ts";
import { encryptToken, decryptToken, randomQrSeed, randomSalt } from "../lib/qr.ts";
import { audit } from "../lib/audit.ts";
import { paginate, jakartaToday, round2, formatDistance } from "../lib/util.ts";

const app = new Hono();

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

async function readJson(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    throw badRequest("Invalid JSON body");
  }
}

function parseBody<T extends z.ZodType>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw badRequest(issue?.message ?? "Invalid request body");
  }
  return result.data as z.infer<T>;
}

const attendanceStatus = z.enum(["present", "absent", "excused", "late"]);

/* ------------------------------------------------------------------ */
/* POST /check-in                                                      */
/* ------------------------------------------------------------------ */

const checkInSchema = z.object({
  qr_token: z.string().min(1, "QR token is required"),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

app.post("/check-in", async (c) => {
  const user = await currentUser(c);
  const clientIp = getClientIp(c);

  if (user.role !== "mahasiswa" || !user.mahasiswaId) {
    throw forbidden("Mahasiswa profile not found");
  }

  const mahasiswa = await one<{ mahasiswa_id: string; nim: string }>(
    `select mahasiswa_id, nim from mahasiswa where user_id = $1`,
    [user.userId],
  );
  if (!mahasiswa) throw forbidden("Mahasiswa profile not found");

  const body = parseBody(checkInSchema, await readJson(c));

  // 1. Decrypt the QR payload.
  let payload: { sesi_id?: string; server_timestamp?: number | string };
  try {
    const plaintext = await decryptToken(body.qr_token);
    payload = JSON.parse(plaintext);
  } catch {
    await audit({
      userId: user.userId,
      kategori: "Geofence",
      aksi: "Failed check-in: invalid or tampered QR token payload",
      ip: clientIp,
      status: "failed",
    });
    throw badRequest("Invalid or expired QR code");
  }

  if (!payload?.sesi_id) {
    await audit({
      userId: user.userId,
      kategori: "Geofence",
      aksi: "Failed check-in: QR payload missing session id",
      ip: clientIp,
      status: "failed",
    });
    throw badRequest("Invalid or expired QR code");
  }

  // 2. Session + room details.
  const session = await one<{
    sesi_id: string;
    status: string;
    jadwal_id: string;
    qr_rotates_every: number;
    session_radius: number | null;
    nama_ruangan: string;
    latitude: number | null;
    longitude: number | null;
    room_radius: number | null;
  }>(
    `select s.sesi_id, s.status, s.jadwal_id, s.qr_rotates_every,
            s.geofence_radius_m as session_radius,
            r.nama_ruangan, r.latitude, r.longitude,
            r.geofence_radius_m as room_radius
       from sesi_kehadiran s
       join jadwal_kelas j on j.jadwal_id = s.jadwal_id
       left join ruangan r on r.ruangan_id = j.ruangan_id
      where s.sesi_id = $1`,
    [payload.sesi_id],
  );
  if (!session) throw notFound("Class session not found");
  if (session.status !== "live") throw badRequest("Sesi kelas tidak aktif");

  // 3. TTL using the session's rotation interval plus a 5s scan buffer.
  const ttlSeconds = (session.qr_rotates_every || 15) + 5;
  const tokenTime =
    typeof payload.server_timestamp === "string"
      ? Date.parse(payload.server_timestamp)
      : Number(payload.server_timestamp);
  if (!Number.isFinite(tokenTime)) throw badRequest("Invalid or expired QR code");

  const ageSeconds = Math.abs(Date.now() - tokenTime) / 1000;
  if (ageSeconds > ttlSeconds) {
    await audit({
      userId: user.userId,
      kategori: "Geofence",
      aksi: `Failed check-in: QR code expired. Token age: ${ageSeconds.toFixed(1)}s, TTL: ${ttlSeconds}s`,
      ip: clientIp,
      status: "failed",
    });
    throw badRequest("QR code expired");
  }

  if (
    session.latitude === null ||
    session.longitude === null ||
    session.nama_ruangan === null
  ) {
    throw new HttpError(500, "Classroom coordinates not configured");
  }

  // 4. Geofence.
  const distance = getDistanceMeters(
    body.latitude,
    body.longitude,
    Number(session.latitude),
    Number(session.longitude),
  );
  const configuredRadius =
    session.session_radius ?? session.room_radius ?? 50;
  const geofenceOut = distance > configuredRadius;

  // 5. IP allowlist — outside the campus network is flagged, not blocked.
  const whitelistRows = await many<{ cidr: string }>(
    `select cidr from ip_whitelist`,
  );
  const subnets = [
    ...DEFAULT_IP_WHITELIST,
    ...whitelistRows.map((row) => row.cidr),
  ];
  const ipAllowed = subnets.some((subnet) => isIpInSubnet(clientIp, subnet));

  const flagged = geofenceOut || !ipAllowed;
  const status = flagged ? "late" : "present";
  const delta = Math.max(0, round2(distance - configuredRadius));

  try {
    await run(
      `insert into presensi
         (mahasiswa_id, sesi_id, waktu_check_in, status, latitude, longitude,
          ip_address, metode, geofence_delta_m, geofence_flagged)
       values ($1, $2, now(), $3, $4, $5, $6, 'qr', $7, $8)`,
      [
        mahasiswa.mahasiswa_id,
        session.sesi_id,
        status,
        body.latitude,
        body.longitude,
        clientIp,
        delta,
        flagged,
      ],
    );
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflict("You have already checked in for this session");
    }
    throw error;
  }

  await audit({
    userId: user.userId,
    kategori: "Attendance Overrides",
    aksi: `Successful check-in for Mahasiswa NIM ${mahasiswa.nim} in Room ${session.nama_ruangan}`,
    ip: clientIp,
    status: "success",
  });

  const message = ipAllowed
    ? "Attendance verified successfully"
    : "Attendance verified successfully (network outside campus whitelist)";

  return ok(c, {
    message,
    status,
    room: session.nama_ruangan,
    distance: formatDistance(distance),
  });
});

/* ------------------------------------------------------------------ */
/* POST /generate-qr-token                                             */
/* ------------------------------------------------------------------ */

const generateQrTokenSchema = z.object({
  sesi_id: uuid("Invalid session ID"),
  ttl_seconds: z.number().int().min(5).max(60),
  covers: z.number().int().min(1).max(5).optional().default(2),
});

app.post("/generate-qr-token", async (c) => {
  const user = await currentUser(c);
  const body = parseBody(generateQrTokenSchema, await readJson(c));

  const session = await assertSessionAccess(user, body.sesi_id);
  if (session.status !== "live") {
    throw badRequest("Cannot generate QR code: session is not live");
  }

  const count = Math.ceil((body.covers * 60) / body.ttl_seconds);
  const tokens: Array<{ qr_token: string; expired_at: string }> = [];
  const params: unknown[] = [];
  const placeholders: string[] = [];

  for (let i = 0; i < count; i++) {
    const serverTimestamp = Date.now() + i * body.ttl_seconds * 1000;
    const expiredAt = new Date(
      serverTimestamp + body.ttl_seconds * 1000,
    ).toISOString();

    const qrToken = await encryptToken(
      JSON.stringify({
        sesi_id: body.sesi_id,
        server_timestamp: serverTimestamp,
        security_salt_token: randomSalt(),
      }),
    );

    tokens.push({ qr_token: qrToken, expired_at: expiredAt });

    const base = params.length;
    params.push(body.sesi_id, qrToken, expiredAt);
    placeholders.push(`($${base + 1}, $${base + 2}, $${base + 3})`);
  }

  await run(
    `insert into qr_code (sesi_id, token, expired_at) values ${placeholders.join(", ")}`,
    params,
  );

  return ok(c, { tokens, ttl_seconds: body.ttl_seconds });
});

/* ------------------------------------------------------------------ */
/* POST /open-session                                                  */
/* ------------------------------------------------------------------ */

const openSessionSchema = z.object({
  jadwal_id: uuid("Invalid jadwal ID"),
  tanggal: z.string().optional(),
  geofence_radius_m: z.number().int().min(1).max(500).optional(),
  qr_rotates_every: z.number().int().min(5).max(60).optional(),
});

app.post("/open-session", async (c) => {
  const user = await currentUser(c);
  if (user.role !== "dosen" && !["admin", "super_admin", "admin_prodi"].includes(user.role)) {
    throw forbidden("Access denied: Lecturer or Admin role required");
  }

  const body = parseBody(openSessionSchema, await readJson(c));
  const jadwal = await assertJadwalAccess(user, body.jadwal_id);

  const existing = await one<{ sesi_id: string }>(
    `select sesi_id from sesi_kehadiran
      where jadwal_id = $1 and status = 'live' limit 1`,
    [body.jadwal_id],
  );
  if (existing) {
    throw conflict("A live session is already active for this class");
  }

  let radius = body.geofence_radius_m;
  if (radius === undefined) {
    if (jadwal.ruangan_id) {
      const room = await one<{ geofence_radius_m: number }>(
        `select geofence_radius_m from ruangan where ruangan_id = $1`,
        [jadwal.ruangan_id],
      );
      radius = room?.geofence_radius_m ?? 50;
    } else {
      radius = 50;
    }
  }

  const qrSeed = randomQrSeed();
  const session = await one<{ sesi_id: string; qr_seed: number }>(
    `insert into sesi_kehadiran
       (jadwal_id, tanggal, waktu_mulai, qr_seed, qr_rotates_every,
        geofence_radius_m, status, dibuka_oleh)
     values ($1, $2, now(), $3, $4, $5, 'live', $6)
     returning sesi_id, qr_seed`,
    [
      body.jadwal_id,
      body.tanggal ?? jakartaToday(),
      qrSeed,
      body.qr_rotates_every ?? 15,
      radius,
      user.dosenId,
    ],
  );

  await audit({
    userId: user.userId,
    kategori: "Schedule Plotting",
    aksi: `open-session: session opened for jadwal ${body.jadwal_id}`,
    ip: getClientIp(c),
    metadata: { sesi_id: session?.sesi_id, jadwal_id: body.jadwal_id },
  });

  return ok(
    c,
    { sesi_id: session!.sesi_id, status: "live", qr_seed: session!.qr_seed },
    201,
  );
});

/* ------------------------------------------------------------------ */
/* POST /close-session                                                 */
/* ------------------------------------------------------------------ */

const sessionIdSchema = z.object({
  sesi_id: uuid("Invalid session ID"),
});

app.post("/close-session", async (c) => {
  const user = await currentUser(c);
  const body = parseBody(sessionIdSchema, await readJson(c));

  await assertSessionAccess(user, body.sesi_id);

  await run(
    `update sesi_kehadiran
        set status = 'completed',
            waktu_selesai = coalesce(waktu_selesai, now())
      where sesi_id = $1`,
    [body.sesi_id],
  );

  await audit({
    userId: user.userId,
    kategori: "Attendance Overrides",
    aksi: `close-session: session ${body.sesi_id} closed`,
    ip: getClientIp(c),
    metadata: { sesi_id: body.sesi_id },
  });

  return ok(c, { message: "Session closed successfully" });
});

/* ------------------------------------------------------------------ */
/* POST /get-live-session                                              */
/* ------------------------------------------------------------------ */

app.post("/get-live-session", async (c) => {
  const user = await requireRole(c, [
    "admin",
    "super_admin",
    "admin_prodi",
    "dosen",
  ]);
  const body = parseBody(sessionIdSchema, await readJson(c));

  const session = await assertSessionAccess(user, body.sesi_id);

  const presentRow = await one<{ present: number }>(
    `select count(*)::int as present
       from presensi
      where sesi_id = $1 and status in ('present', 'late', 'excused')`,
    [body.sesi_id],
  );
  const enrolledRow = await one<{ enrolled: number }>(
    `select count(*)::int as enrolled
       from pendaftaran_kelas
      where jadwal_id = $1`,
    [session.jadwal_id],
  );

  const present = presentRow?.present ?? 0;
  const enrolled = enrolledRow?.enrolled ?? 0;
  const absent = Math.max(0, enrolled - present);

  const recent = await many<{
    presensi_id: string;
    waktu_check_in: string | null;
    status: string;
    mahasiswa_id: string;
    nim: string;
    nama: string;
  }>(
    `select p.presensi_id, p.waktu_check_in, p.status, p.mahasiswa_id,
            m.nim, m.nama
       from presensi p
       join mahasiswa m on m.mahasiswa_id = p.mahasiswa_id
      where p.sesi_id = $1
      order by p.waktu_check_in desc
      limit 20`,
    [body.sesi_id],
  );

  return ok(c, {
    sesi_id: session.sesi_id,
    status: session.status,
    waktu_mulai: (session as unknown as { waktu_mulai: string }).waktu_mulai,
    geofence_radius_m: session.geofence_radius_m,
    qr_rotates_every: session.qr_rotates_every,
    counts: { present, absent },
    recent_checkins: recent,
  });
});

/* ------------------------------------------------------------------ */
/* POST /list-sessions                                                 */
/* ------------------------------------------------------------------ */

const listSessionsSchema = z.object({
  jadwal_id: uuid("Invalid jadwal ID"),
  page: z.number().int().min(1).optional().default(1),
  limit: z.number().int().min(1).max(100).optional().default(10),
});

app.post("/list-sessions", async (c) => {
  const user = await currentUser(c);
  const body = parseBody(listSessionsSchema, await readJson(c));
  await assertJadwalAccess(user, body.jadwal_id);

  const totalRow = await one<{ total: number }>(
    `select count(*)::int as total from sesi_kehadiran where jadwal_id = $1`,
    [body.jadwal_id],
  );
  const total = totalRow?.total ?? 0;
  const { pagination, offset } = paginate(body.page, body.limit, total);

  const sessions = await many<{
    sesi_id: string;
    jadwal_id: string;
    tanggal: string;
    waktu_mulai: string | null;
    waktu_selesai: string | null;
    status: string;
    geofence_radius_m: number;
    qr_rotates_every: number;
  }>(
    `select sesi_id, jadwal_id, tanggal, waktu_mulai, waktu_selesai, status,
            geofence_radius_m, qr_rotates_every
       from sesi_kehadiran
      where jadwal_id = $1
      order by tanggal desc, waktu_mulai desc
      limit $2 offset $3`,
    [body.jadwal_id, body.limit, offset],
  );

  const sessionIds = sessions.map((row) => row.sesi_id);
  const presentBySession = new Map<string, number>();

  if (sessionIds.length > 0) {
    const counts = await many<{ sesi_id: string; present: number }>(
      `select sesi_id, count(*)::int as present
         from presensi
        where sesi_id = any($1::uuid[])
          and status in ('present', 'late', 'excused')
        group by sesi_id`,
      [sessionIds],
    );
    for (const row of counts) presentBySession.set(row.sesi_id, row.present);
  }

  const enrolledRow = await one<{ enrolled: number }>(
    `select count(*)::int as enrolled from pendaftaran_kelas where jadwal_id = $1`,
    [body.jadwal_id],
  );
  const enrolled = enrolledRow?.enrolled ?? 0;

  const enriched = sessions.map((row) => {
    const present = presentBySession.get(row.sesi_id) ?? 0;
    const absent = Math.max(0, enrolled - present);
    return {
      ...row,
      present_count: present,
      absent_count: absent,
      total_count: present + absent,
    };
  });

  await audit({
    userId: user.userId,
    kategori: "Schedule Plotting",
    aksi: "list-sessions",
    ip: getClientIp(c),
    metadata: { jadwal_id: body.jadwal_id },
  });

  return ok(c, { sessions: enriched, pagination });
});

/* ------------------------------------------------------------------ */
/* POST /update-session-settings                                       */
/* ------------------------------------------------------------------ */

const updateSettingsSchema = z.object({
  sesi_id: uuid("Invalid session ID"),
  geofence_radius_m: z.number().int().min(10).max(500).optional(),
  qr_rotates_every: z.number().int().min(5).max(60).optional(),
});

app.post("/update-session-settings", async (c) => {
  const user = await currentUser(c);
  const body = parseBody(updateSettingsSchema, await readJson(c));
  await assertSessionAccess(user, body.sesi_id);

  const sets: string[] = [];
  const params: unknown[] = [];
  if (body.geofence_radius_m !== undefined) {
    params.push(body.geofence_radius_m);
    sets.push(`geofence_radius_m = $${params.length}`);
  }
  if (body.qr_rotates_every !== undefined) {
    params.push(body.qr_rotates_every);
    sets.push(`qr_rotates_every = $${params.length}`);
  }

  if (sets.length > 0) {
    params.push(body.sesi_id);
    await run(
      `update sesi_kehadiran set ${sets.join(", ")} where sesi_id = $${params.length}`,
      params,
    );
  }

  await audit({
    userId: user.userId,
    kategori: "Attendance Overrides",
    aksi: `update-session-settings: session ${body.sesi_id} settings updated`,
    ip: getClientIp(c),
    metadata: {
      sesi_id: body.sesi_id,
      geofence_radius_m: body.geofence_radius_m ?? null,
      qr_rotates_every: body.qr_rotates_every ?? null,
    },
  });

  return ok(c, { message: "Settings updated successfully" });
});

/* ------------------------------------------------------------------ */
/* POST /update-session                                                */
/* ------------------------------------------------------------------ */

const updateSessionSchema = z.object({
  sesi_id: uuid("Invalid session ID"),
  tanggal: z.string().optional(),
  geofence_radius_m: z.number().int().min(10).max(500).optional(),
  qr_rotates_every: z.number().int().min(5).max(60).optional(),
});

app.post("/update-session", async (c) => {
  const user = await currentUser(c);
  const body = parseBody(updateSessionSchema, await readJson(c));
  await assertSessionAccess(user, body.sesi_id);

  const sets: string[] = [];
  const params: unknown[] = [];
  if (body.tanggal !== undefined && body.tanggal !== "") {
    params.push(body.tanggal);
    sets.push(`tanggal = $${params.length}`);
  }
  if (body.geofence_radius_m !== undefined) {
    params.push(body.geofence_radius_m);
    sets.push(`geofence_radius_m = $${params.length}`);
  }
  if (body.qr_rotates_every !== undefined) {
    params.push(body.qr_rotates_every);
    sets.push(`qr_rotates_every = $${params.length}`);
  }

  if (sets.length === 0) throw badRequest("No fields to update");

  params.push(body.sesi_id);
  await run(
    `update sesi_kehadiran set ${sets.join(", ")} where sesi_id = $${params.length}`,
    params,
  );

  await audit({
    userId: user.userId,
    kategori: "Attendance Overrides",
    aksi: `update-session: session ${body.sesi_id} updated`,
    ip: getClientIp(c),
    metadata: {
      sesi_id: body.sesi_id,
      tanggal: body.tanggal ?? null,
      geofence_radius_m: body.geofence_radius_m ?? null,
      qr_rotates_every: body.qr_rotates_every ?? null,
    },
  });

  return ok(c, { message: "Session updated successfully" });
});

/* ------------------------------------------------------------------ */
/* POST /reopen-session                                                */
/* ------------------------------------------------------------------ */

app.post("/reopen-session", async (c) => {
  const user = await currentUser(c);
  const body = parseBody(updateSessionSchema, await readJson(c));
  const session = await assertSessionAccess(user, body.sesi_id);

  if (session.status !== "completed") {
    throw badRequest("Only completed sessions can be reopened");
  }

  const existing = await one<{ sesi_id: string }>(
    `select sesi_id from sesi_kehadiran
      where jadwal_id = $1 and status = 'live' and sesi_id <> $2
      limit 1`,
    [session.jadwal_id, body.sesi_id],
  );
  if (existing) {
    throw conflict("A live session is already active for this class");
  }

  const sets: string[] = [
    `status = 'live'`,
    `waktu_selesai = null`,
    `waktu_mulai = now()`,
  ];
  const params: unknown[] = [];
  params.push(randomQrSeed());
  sets.push(`qr_seed = $${params.length}`);

  if (body.tanggal !== undefined && body.tanggal !== "") {
    params.push(body.tanggal);
    sets.push(`tanggal = $${params.length}`);
  }
  if (body.geofence_radius_m !== undefined) {
    params.push(body.geofence_radius_m);
    sets.push(`geofence_radius_m = $${params.length}`);
  }
  if (body.qr_rotates_every !== undefined) {
    params.push(body.qr_rotates_every);
    sets.push(`qr_rotates_every = $${params.length}`);
  }

  params.push(body.sesi_id);
  await run(
    `update sesi_kehadiran set ${sets.join(", ")} where sesi_id = $${params.length}`,
    params,
  );

  await audit({
    userId: user.userId,
    kategori: "Attendance Overrides",
    aksi: `reopen-session: session ${body.sesi_id} reopened`,
    ip: getClientIp(c),
    metadata: { sesi_id: body.sesi_id },
  });

  return ok(c, { sesi_id: body.sesi_id, status: "live" });
});

/* ------------------------------------------------------------------ */
/* POST /delete-session                                                */
/* ------------------------------------------------------------------ */

app.post("/delete-session", async (c) => {
  const user = await currentUser(c);
  const body = parseBody(sessionIdSchema, await readJson(c));

  await assertSessionAccess(user, body.sesi_id);

  await transaction(async (client) => {
    await client.query(`delete from presensi where sesi_id = $1`, [body.sesi_id]);
    await client.query(`delete from qr_code where sesi_id = $1`, [body.sesi_id]);
    await client.query(`delete from sesi_kehadiran where sesi_id = $1`, [body.sesi_id]);
  });

  await audit({
    userId: user.userId,
    kategori: "Attendance Overrides",
    aksi: `delete-session: session ${body.sesi_id} deleted`,
    ip: getClientIp(c),
    metadata: { sesi_id: body.sesi_id },
  });

  return ok(c, { message: "Session deleted successfully" });
});

/* ------------------------------------------------------------------ */
/* POST /correct-attendance                                            */
/* ------------------------------------------------------------------ */

const correctAttendanceSchema = z.object({
  presensi_id: uuid("Invalid presensi ID"),
  status_baru: attendanceStatus,
  alasan: z.string().optional(),
});

app.post("/correct-attendance", async (c) => {
  const user = await currentUser(c);
  const body = parseBody(correctAttendanceSchema, await readJson(c));

  const presensi = await one<{
    presensi_id: string;
    status: string;
    sesi_id: string;
    dosen_id: string | null;
  }>(
    `select p.presensi_id, p.status, p.sesi_id, j.dosen_id
       from presensi p
       join sesi_kehadiran s on s.sesi_id = p.sesi_id
       join jadwal_kelas j on j.jadwal_id = s.jadwal_id
      where p.presensi_id = $1`,
    [body.presensi_id],
  );
  if (!presensi) throw notFound("Presensi record not found");

  const session = await assertSessionAccess(user, presensi.sesi_id);
  const changedBy = user.dosenId ?? presensi.dosen_id ?? session.dosen_id;
  if (!changedBy) throw badRequest("No lecturer is assigned to this session");

  const statusBefore = presensi.status;

  await transaction(async (client) => {
    await client.query(
      `insert into koreksi_presensi
         (presensi_id, diubah_oleh, status_sebelum, status_sesudah, alasan)
       values ($1, $2, $3, $4, $5)`,
      [body.presensi_id, changedBy, statusBefore, body.status_baru, body.alasan ?? null],
    );
    await client.query(`update presensi set status = $1 where presensi_id = $2`, [
      body.status_baru,
      body.presensi_id,
    ]);
  });

  await audit({
    userId: user.userId,
    kategori: "Attendance Overrides",
    aksi: `Correction: presensi ${body.presensi_id} ${statusBefore}→${body.status_baru}`,
    ip: getClientIp(c),
    metadata: { presensi_id: body.presensi_id },
  });

  return ok(c, { message: "Attendance corrected successfully" });
});

/* ------------------------------------------------------------------ */
/* POST /bulk-mark-present                                             */
/* ------------------------------------------------------------------ */

const bulkMarkSchema = z.object({
  sesi_id: uuid("Invalid session ID"),
  mahasiswa_ids: z.array(uuid()).min(1).max(200),
  status: attendanceStatus,
});

app.post("/bulk-mark-present", async (c) => {
  const user = await currentUser(c);
  const body = parseBody(bulkMarkSchema, await readJson(c));
  const session = await assertSessionAccess(user, body.sesi_id);
  const changedBy = user.dosenId ?? session.dosen_id;
  if (!changedBy) throw badRequest("No lecturer is assigned to this session");

  const result = await transaction(async (client) => {
    const existingResult = await client.query(
      `select presensi_id, mahasiswa_id, status
         from presensi
        where sesi_id = $1 and mahasiswa_id = any($2::uuid[])`,
      [body.sesi_id, body.mahasiswa_ids],
    );

    const existing = new Map<
      string,
      { presensi_id: string; status: string }
    >();
    for (const row of existingResult.rows) {
      existing.set(row.mahasiswa_id, {
        presensi_id: row.presensi_id,
        status: row.status,
      });
    }

    let updated = 0;
    let inserted = 0;

    for (const mahasiswaId of body.mahasiswa_ids) {
      const current = existing.get(mahasiswaId);
      if (current) {
        if (current.status !== body.status) {
          await client.query(`update presensi set status = $1 where presensi_id = $2`, [
            body.status,
            current.presensi_id,
          ]);
          await client.query(
            `insert into koreksi_presensi
               (presensi_id, diubah_oleh, status_sebelum, status_sesudah, alasan)
             values ($1, $2, $3, $4, $5)`,
            [
              current.presensi_id,
              changedBy,
              current.status,
              body.status,
              "Bulk correction",
            ],
          );
          updated++;
        }
      } else {
        await client.query(
          `insert into presensi
             (sesi_id, mahasiswa_id, waktu_check_in, metode, status)
           values ($1, $2, now(), 'manual', $3)`,
          [body.sesi_id, mahasiswaId, body.status],
        );
        inserted++;
      }
    }

    return { updated, inserted };
  });

  await audit({
    userId: user.userId,
    kategori: "Attendance Overrides",
    aksi: `Bulk mark: ${result.inserted} inserted, ${result.updated} updated to ${body.status} in session ${body.sesi_id}`,
    ip: getClientIp(c),
    metadata: { sesi_id: body.sesi_id, ...result },
  });

  return ok(c, {
    message: "Bulk attendance updated",
    updated: result.updated,
    inserted: result.inserted,
  });
});

export default app;
