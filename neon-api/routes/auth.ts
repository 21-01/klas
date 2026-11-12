import { Hono } from "hono";
import { z } from "zod";
import { one, many, run, transaction, isUniqueViolation, isForeignKeyViolation } from "../lib/db.ts";
import { HttpError, badRequest, unauthorized, forbidden, ok } from "../lib/http.ts";
import { currentUser, requireAdmin, getClientIp, type AppUser } from "../lib/auth.ts";
import { audit } from "../lib/audit.ts";
import { paginate, jakartaToday, jakartaDayName, rate } from "../lib/util.ts";
import {
  changePassword,
  deleteAuthUser,
  fetchJwtForSessionToken,
  signInWithPassword,
  signUpWithPassword,
  verifySessionToken,
  type SignInResult,
} from "../lib/neon-auth.ts";

const app = new Hono();

/** Reads a JSON body; empty bodies are treated as `{}` (most routes are optional-body). */
async function readBody(c: { req: { text: () => Promise<string> } }): Promise<unknown> {
  const raw = await c.req.text();
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw badRequest("Invalid JSON body");
  }
}

/** Zod validation mapped to the contract's 400 `{ error }` envelope. */
function parse<T extends z.ZodType>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) throw badRequest(result.error.issues[0]?.message ?? "Invalid request body");
  return result.data;
}

const loginSchema = z.object({
  email: z.email("A valid email is required"),
  password: z.string().min(1, "Password is required"),
});

const refreshSchema = z.object({
  refresh_token: z.string().min(1, "Refresh token is required"),
  /** Signed session cookie, e.g. `__Secure-neon-auth.session_token=<token>.<sig>`. */
  cookie: z.string().min(1).optional(),
});

const changePasswordSchema = z.object({
  current_password: z.string().min(1, "Current password is required"),
  new_password: z.string().min(8, "New password must be at least 8 characters"),
});

const logsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  semester: z.string().optional(),
  tahun_akademik: z.string().optional(),
});

const statsSchema = z.object({
  semester: z.string().optional(),
  tahun_akademik: z.string().optional(),
});

const notificationsSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("list"),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    is_read: z.boolean().optional(),
    tipe: z.string().optional(),
    user_id: z.uuid().optional(),
    from_date: z.string().optional(),
    to_date: z.string().optional(),
  }),
  z.object({
    action: z.literal("mark-read"),
    notifikasi_id: z.union([z.uuid(), z.array(z.uuid())]),
  }),
  z.object({
    action: z.literal("mark-all-read"),
    user_id: z.uuid().optional(),
  }),
  z.object({
    action: z.literal("stats"),
  }),
]);

const provisionSchema = z.object({
  email: z.email("A valid email is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1, "Name is required"),
  role: z.enum(["mahasiswa", "dosen"]),
  identifier: z.string().min(1, "Identifier is required"),
  prodi_id: z.coerce.number().int("prodi_id must be an integer"),
});

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Extracts the raw session token from a signed Better Auth cookie. Accepts the
 * full `name=value` pair, a cookie header with several pairs, or a bare value.
 */
function signedCookieToken(cookie: string): string | null {
  const pairs = cookie.split(";").map((part) => part.trim()).filter(Boolean);
  for (const pair of pairs) {
    const separator = pair.indexOf("=");
    if (separator <= 0) continue;
    if (!pair.slice(0, separator).trim().endsWith("session_token")) continue;
    const value = pair.slice(separator + 1).split(".")[0];
    return decodeCookieValue(value);
  }
  if (!cookie.includes("=")) return decodeCookieValue(cookie.split(".")[0]);
  return null;
}

function decodeCookieValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Notification to admins about brute-force traffic; no-op when there is no admin. */
async function notifyBruteForce(message: string): Promise<void> {
  await run(
    `insert into notifikasi (user_id, tipe, judul, pesan)
     select u.user_id, 'brute_force', 'Brute Force Warning', $1
       from users u
      where u.role in ('admin', 'super_admin')
      order by u.created_at
      limit 1`,
    [message],
  );
}

/** Notification admins for notifications; old function treats admin/super_admin as admin. */
function notificationsAdmin(user: AppUser): boolean {
  return user.role === "admin" || user.role === "super_admin";
}

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

app.post("/login", async (c) => {
  const { email, password } = parse(loginSchema, await readBody(c));
  const ip = getClientIp(c);

  const limit = await one<{ blocked: boolean; attempt_count: number }>(
    `select * from public.check_and_record_failed_login($1::inet, $2, 60, 5)`,
    [ip, email],
  );

  if (limit?.blocked) {
    await notifyBruteForce(`>5 failed login attempts from IP ${ip} in the last 1 minute. Tried email: ${email}`);
    await audit({
      kategori: "Authentication",
      aksi: `IP ${ip} blocked due to too many failed login attempts. Tried email: ${email}`,
      ip,
      status: "failed",
    });
    throw new HttpError(429, "Too many failed attempts. Try again later.");
  }

  let signed: SignInResult;
  try {
    signed = await signInWithPassword(email, password);
  } catch (error) {
    await audit({
      kategori: "Authentication",
      aksi: `Failed login attempt for email: ${email}. Error: ${(error as Error).message}`,
      ip,
      status: "failed",
    });
    if (error instanceof HttpError && error.status === 401) {
      throw unauthorized("Invalid email or password");
    }
    throw error;
  }

  await run(`delete from failed_login_attempts where ip_address = $1::inet`, [ip]);

  const profile = await one<{ user_id: string; email: string; name: string; role: string; is_active: boolean }>(
    `select user_id, email, name, role, is_active from users where user_id = $1`,
    [signed.user.id],
  );
  if (!profile) throw forbidden("User profile not found");

  await audit({
    kategori: "Authentication",
    aksi: `Successful login for user ${email} (Role: ${profile.role})`,
    ip,
    userId: profile.user_id,
    status: "success",
  });

  let accessToken = await fetchJwtForSessionToken(signed.token, signed.cookie);
  if (!accessToken) {
    console.warn("[auth] could not mint a JWT on login; using the session token");
    accessToken = signed.token;
  }

  const session = await verifySessionToken(signed.token);
  const expiresAt = session
    ? session.expiresAt.toISOString()
    : new Date(Date.now() + SEVEN_DAYS_MS).toISOString();

  return ok(c, {
    session: {
      access_token: accessToken,
      refresh_token: signed.token,
      expires_at: expiresAt,
      // Additive: lets non-browser clients mint a fresh JWT via /refresh-session.
      ...(signed.cookie ? { cookie: signed.cookie } : {}),
    },
    user: {
      id: profile.user_id,
      email: profile.email ?? signed.user.email,
      name: profile.name ?? signed.user.name,
      role: profile.role,
    },
  });
});

app.post("/refresh-session", async (c) => {
  const { refresh_token, cookie: bodyCookie } = parse(refreshSchema, await readBody(c));
  const ip = getClientIp(c);

  // Accept the signed session cookie from the body or the request Cookie header.
  // It must belong to the same session as `refresh_token`.
  const cookie = bodyCookie ?? c.req.header("cookie") ?? undefined;
  const cookieToken = cookie ? signedCookieToken(cookie) : null;
  if (cookie && cookieToken && cookieToken !== refresh_token) {
    await audit({
      kategori: "Authentication",
      aksi: `Rejected session refresh from IP ${ip}: cookie does not match refresh token`,
      ip,
      status: "failed",
    });
    throw unauthorized("Session cookie does not match refresh token");
  }

  const session = await verifySessionToken(refresh_token);
  if (!session) {
    await audit({
      kategori: "Authentication",
      aksi: `Failed session refresh attempt from IP ${ip}: invalid or expired token`,
      ip,
      status: "failed",
    });
    throw unauthorized("Invalid refresh token");
  }

  const profile = await one<{ user_id: string; email: string; name: string; role: string }>(
    `select user_id, email, name, role from users where user_id = $1`,
    [session.userId],
  );
  if (!profile) throw forbidden("User profile not found");

  let accessToken = await fetchJwtForSessionToken(refresh_token, cookie);
  if (!accessToken) {
    console.warn("[auth] /token unavailable for refresh; reusing the session token");
    accessToken = refresh_token;
  }

  return ok(c, {
    session: {
      access_token: accessToken,
      refresh_token,
      expires_at: session.expiresAt.toISOString(),
    },
    user: {
      id: profile.user_id,
      email: profile.email,
      name: profile.name,
      role: profile.role,
    },
  });
});

app.post("/change-password", async (c) => {
  const user = await currentUser(c);
  const ip = getClientIp(c);
  const { current_password, new_password } = parse(changePasswordSchema, await readBody(c));

  try {
    await changePassword(user.userId, current_password, new_password);
  } catch (error) {
    await audit({
      kategori: "Security Policies",
      aksi: `Failed password change attempt for user ${user.email}`,
      ip,
      userId: user.userId,
      status: "failed",
      metadata: { reason: (error as Error).message },
    });
    throw error;
  }

  await audit({
    kategori: "Security Policies",
    aksi: `Password updated successfully for user ${user.email}`,
    ip,
    userId: user.userId,
    status: "success",
  });

  return ok(c, { message: "Password updated successfully" });
});

// ---------------------------------------------------------------------------
// Self-service profile / dashboard / attendance
// ---------------------------------------------------------------------------

app.post("/get-my-profile", async (c) => {
  const user = await currentUser(c);

  if (user.role === "dosen") {
    const dosen = user.dosenId
      ? await one<{ nama: string }>(`select nama from dosen where dosen_id = $1`, [user.dosenId])
      : null;
    if (!dosen) throw new HttpError(404, "Dosen profile not found");
    return ok(c, {
      user_id: user.userId,
      email: user.email,
      role: user.role,
      nama: dosen.nama,
    });
  }

  if (user.role === "admin" || user.role === "super_admin" || user.role === "admin_prodi") {
    return ok(c, {
      user_id: user.userId,
      email: user.email,
      role: user.role,
      name: user.name,
    });
  }

  const mahasiswa = user.mahasiswaId
    ? await one<{
        nim: string;
        nama: string;
        angkatan: string | null;
        jenis_kelamin: string | null;
        gpa: string | null;
        pembimbing_akademik: string | null;
        kode_prodi: string | null;
        nama_prodi: string | null;
      }>(
        `select m.nim, m.nama, m.angkatan, m.jenis_kelamin, m.gpa, m.pembimbing_akademik,
                p.kode_prodi, p.nama_prodi
           from mahasiswa m
           left join program_studi p on p.prodi_id = m.prodi_id
          where m.mahasiswa_id = $1`,
        [user.mahasiswaId],
      )
    : null;

  if (!mahasiswa) throw new HttpError(404, "Mahasiswa profile not found");

  return ok(c, {
    user_id: user.userId,
    email: user.email,
    role: user.role,
    nim: mahasiswa.nim,
    nama: mahasiswa.nama,
    angkatan: mahasiswa.angkatan,
    jenis_kelamin: mahasiswa.jenis_kelamin,
    gpa: mahasiswa.gpa === null ? null : Number(mahasiswa.gpa),
    pembimbing_akademik: mahasiswa.pembimbing_akademik,
    prodi: {
      kode_prodi: mahasiswa.kode_prodi,
      nama_prodi: mahasiswa.nama_prodi,
    },
  });
});

app.post("/get-my-dashboard", async (c) => {
  const user = await currentUser(c);
  if (!user.mahasiswaId) throw new HttpError(404, "Mahasiswa profile not found");

  const date = jakartaToday();
  const day = jakartaDayName(date);

  const rows = await many<{
    jadwal_id: string;
    kode_mk: string;
    nama_mk: string;
    sks: number;
    waktu_mulai: string;
    waktu_selesai: string;
    nama_ruangan: string | null;
    sesi_id: string | null;
    sesi_status: string | null;
  }>(
    `select j.jadwal_id, mk.kode_mk, mk.nama_mk, mk.sks,
            j.waktu_mulai, j.waktu_selesai, r.nama_ruangan,
            s.sesi_id, s.status as sesi_status
       from pendaftaran_kelas p
       join jadwal_kelas j on j.jadwal_id = p.jadwal_id
       join mata_kuliah mk on mk.mk_id = j.mk_id
       left join ruangan r on r.ruangan_id = j.ruangan_id
       left join lateral (
         select sesi_id, status
           from sesi_kehadiran
          where jadwal_id = j.jadwal_id
          order by waktu_mulai desc nulls last, tanggal desc
          limit 1
       ) s on true
      where p.mahasiswa_id = $1 and j.hari = $2 and j.is_active = true
      order by j.waktu_mulai`,
    [user.mahasiswaId, day],
  );

  return ok(c, {
    date,
    day,
    classes: rows.map((row) => ({
      jadwal_id: row.jadwal_id,
      mata_kuliah: { kode_mk: row.kode_mk, nama_mk: row.nama_mk, sks: row.sks },
      waktu_mulai: row.waktu_mulai,
      waktu_selesai: row.waktu_selesai,
      ruangan: row.nama_ruangan,
      sesi_id: row.sesi_id,
      sesi_status: row.sesi_status,
    })),
  });
});

app.post("/get-my-logs", async (c) => {
  const user = await currentUser(c);
  if (!user.mahasiswaId) throw new HttpError(404, "Mahasiswa profile not found");

  const { page, limit, semester, tahun_akademik } = parse(logsSchema, await readBody(c));
  const { pagination, offset } = paginate(page, limit, 0);

  const params: unknown[] = [user.mahasiswaId];
  const filters: string[] = [];
  if (semester) {
    params.push(semester);
    filters.push(`j.semester = $${params.length}`);
  }
  if (tahun_akademik) {
    params.push(tahun_akademik);
    filters.push(`j.tahun_akademik = $${params.length}`);
  }
  const where = [`p.mahasiswa_id = $1`, ...filters].join(" and ");

  const countRow = await one<{ total: number }>(
    `select count(*)::int as total
       from presensi p
       join sesi_kehadiran s on s.sesi_id = p.sesi_id
       join jadwal_kelas j on j.jadwal_id = s.jadwal_id
      where ${where}`,
    params,
  );
  const total = countRow?.total ?? 0;

  const rows = await many<{
    presensi_id: string;
    waktu_check_in: string | null;
    status: string;
    metode: string;
    latitude: string | null;
    longitude: string | null;
    geofence_flagged: boolean;
    geofence_delta_m: string | null;
    tanggal: string;
    sesi_waktu_mulai: string | null;
    sesi_waktu_selesai: string | null;
    kode_mk: string;
    nama_mk: string;
    sks: number;
  }>(
    `select p.presensi_id, p.waktu_check_in, p.status, p.metode,
            p.latitude, p.longitude, p.geofence_flagged, p.geofence_delta_m,
            s.tanggal::text as tanggal, s.waktu_mulai as sesi_waktu_mulai,
            s.waktu_selesai as sesi_waktu_selesai,
            mk.kode_mk, mk.nama_mk, mk.sks
       from presensi p
       join sesi_kehadiran s on s.sesi_id = p.sesi_id
       join jadwal_kelas j on j.jadwal_id = s.jadwal_id
       join mata_kuliah mk on mk.mk_id = j.mk_id
      where ${where}
      order by p.waktu_check_in desc nulls last
      limit $${params.length + 1} offset $${params.length + 2}`,
    [...params, limit, offset],
  );

  return ok(c, {
    logs: rows.map((row) => ({
      presensi_id: row.presensi_id,
      waktu_check_in: row.waktu_check_in,
      status: row.status,
      metode: row.metode,
      latitude: row.latitude === null ? null : Number(row.latitude),
      longitude: row.longitude === null ? null : Number(row.longitude),
      geofence_flagged: row.geofence_flagged,
      geofence_delta_m: row.geofence_delta_m === null ? null : Number(row.geofence_delta_m),
      sesi: {
        tanggal: row.tanggal,
        waktu_mulai: row.sesi_waktu_mulai,
        waktu_selesai: row.sesi_waktu_selesai,
        mata_kuliah: { kode_mk: row.kode_mk, nama_mk: row.nama_mk, sks: row.sks },
      },
    })),
    pagination: { ...pagination, total, total_pages: Math.ceil(total / limit) || 0 },
  });
});

app.post("/get-attendance-stats", async (c) => {
  const user = await currentUser(c);
  if (!user.mahasiswaId) throw new HttpError(404, "Mahasiswa profile not found");

  const { semester, tahun_akademik } = parse(statsSchema, await readBody(c));

  const params: unknown[] = [user.mahasiswaId];
  const filters: string[] = [];
  if (semester) {
    params.push(semester);
    filters.push(`j.semester = $${params.length}`);
  }
  if (tahun_akademik) {
    params.push(tahun_akademik);
    filters.push(`j.tahun_akademik = $${params.length}`);
  }

  const row = await one<{
    total: number;
    present: number;
    absent: number;
    excused: number;
    late: number;
  }>(
    `select count(*)::int as total,
            count(*) filter (where p.status = 'present')::int as present,
            count(*) filter (where p.status = 'absent')::int as absent,
            count(*) filter (where p.status = 'excused')::int as excused,
            count(*) filter (where p.status = 'late')::int as late
       from presensi p
       join sesi_kehadiran s on s.sesi_id = p.sesi_id
       join jadwal_kelas j on j.jadwal_id = s.jadwal_id
      where p.mahasiswa_id = $1${filters.map((f) => ` and ${f}`).join("")}`,
    params,
  );

  const total = row?.total ?? 0;
  const breakdown = {
    present: row?.present ?? 0,
    absent: row?.absent ?? 0,
    excused: row?.excused ?? 0,
    late: row?.late ?? 0,
  };

  return ok(c, {
    total_sessions: total,
    breakdown,
    attendance_rate: rate(breakdown.present + breakdown.late, total),
    semester: semester ?? null,
    tahun_akademik: tahun_akademik ?? null,
  });
});

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

app.post("/get-notifications", async (c) => {
  const user = await currentUser(c);
  const isAdmin = notificationsAdmin(user);
  const isSuperAdmin = user.role === "super_admin";
  const payload = parse(notificationsSchema, await readBody(c));

  if (payload.action === "list") {
    const { page, limit, is_read, tipe, user_id, from_date, to_date } = payload;
    const params: unknown[] = [];
    const filters: string[] = [];

    if (is_read !== undefined) {
      params.push(is_read);
      filters.push(`n.is_read = $${params.length}`);
    }
    if (tipe !== undefined) {
      params.push(tipe);
      filters.push(`n.tipe::text = $${params.length}`);
    }
    const requestedUser = isAdmin ? user_id : user.userId;
    if (requestedUser !== undefined) {
      params.push(requestedUser);
      filters.push(`n.user_id = $${params.length}`);
    }
    if (from_date) {
      params.push(from_date);
      filters.push(`n.created_at >= $${params.length}`);
    }
    if (to_date) {
      params.push(to_date);
      filters.push(`n.created_at <= $${params.length}`);
    }
    const where = filters.length ? `where ${filters.join(" and ")}` : "";

    const countRow = await one<{ total: number }>(
      `select count(*)::int as total from notifikasi n ${where}`,
      params,
    );
    const total = countRow?.total ?? 0;

    const rows = await many<{
      notifikasi_id: string;
      user_id: string | null;
      tipe: string;
      judul: string;
      pesan: string | null;
      is_read: boolean;
      created_at: string;
      u_email: string | null;
      u_name: string | null;
      u_role: string | null;
    }>(
      `select n.notifikasi_id, n.user_id, n.tipe, n.judul, n.pesan, n.is_read, n.created_at,
              u.email as u_email, u.name as u_name, u.role as u_role
         from notifikasi n
         left join users u on u.user_id = n.user_id
         ${where}
        order by n.created_at desc
        limit $${params.length + 1} offset $${params.length + 2}`,
      [...params, limit, (page - 1) * limit],
    );

    return ok(c, {
      notifications: rows.map((row) => ({
        notifikasi_id: row.notifikasi_id,
        user_id: row.user_id,
        tipe: row.tipe,
        judul: row.judul,
        pesan: row.pesan,
        is_read: row.is_read,
        created_at: row.created_at,
        user: row.user_id
          ? { user_id: row.user_id, email: row.u_email, name: row.u_name, role: row.u_role }
          : null,
      })),
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) || 0 },
    });
  }

  if (payload.action === "mark-read") {
    const ids = Array.isArray(payload.notifikasi_id) ? payload.notifikasi_id : [payload.notifikasi_id];
    if (isAdmin) {
      await run(`update notifikasi set is_read = true where notifikasi_id = any($1::uuid[])`, [ids]);
    } else {
      await run(
        `update notifikasi set is_read = true
          where notifikasi_id = any($1::uuid[]) and user_id = $2`,
        [ids, user.userId],
      );
    }
    return ok(c, { message: `${ids.length} notification(s) marked as read` });
  }

  if (payload.action === "mark-all-read") {
    const target = isSuperAdmin ? (payload.user_id ?? null) : user.userId;
    await run(
      `update notifikasi set is_read = true
        where ($1::uuid is null or user_id = $1::uuid)`,
      [target],
    );
    return ok(c, { message: "All notifications marked as read" });
  }

  // stats
  const scope = isAdmin ? "" : "where user_id = $1";
  const scopeParams: unknown[] = isAdmin ? [] : [user.userId];
  const totals = await one<{ total: number; unread: number }>(
    `select count(*)::int as total,
            count(*) filter (where not is_read)::int as unread
       from notifikasi ${scope}`,
    scopeParams,
  );
  const typeRows = await many<{ tipe: string; count: number }>(
    `select tipe, count(*)::int as count from notifikasi ${scope} group by tipe`,
    scopeParams,
  );
  const by_type: Record<string, number> = {};
  for (const row of typeRows) by_type[row.tipe] = row.count;

  return ok(c, {
    total: totals?.total ?? 0,
    unread: totals?.unread ?? 0,
    by_type,
  });
});

// ---------------------------------------------------------------------------
// Admin provisioning
// ---------------------------------------------------------------------------

app.post("/provision-user", async (c) => {
  const caller = await requireAdmin(c);
  const ip = getClientIp(c);
  const { email, password, name, role, identifier, prodi_id } = parse(
    provisionSchema,
    await readBody(c),
  );

  const created = await signUpWithPassword(email, password, name);
  const newUserId = created.user.id;

  try {
    await transaction(async (client) => {
      await client.query(
        `insert into users (user_id, email, name, role) values ($1, $2, $3, $4)`,
        [newUserId, email, name, role],
      );
      if (role === "mahasiswa") {
        await client.query(
          `insert into mahasiswa (nim, nama, user_id, prodi_id) values ($1, $2, $3, $4)`,
          [identifier, name, newUserId, prodi_id],
        );
      } else {
        await client.query(
          `insert into dosen (nip, nama, user_id, prodi_id) values ($1, $2, $3, $4)`,
          [identifier, name, newUserId, prodi_id],
        );
      }
    });
  } catch (error) {
    await deleteAuthUser(newUserId);
    if (isUniqueViolation(error)) {
      throw new HttpError(409, "A user with this email or identifier already exists");
    }
    if (isForeignKeyViolation(error)) {
      throw badRequest("Unknown prodi_id");
    }
    throw error;
  }

  await audit({
    kategori: "Master Data",
    aksi: `Provisioned user ${email} (${role}) with identifier ${identifier}`,
    ip,
    userId: caller.userId,
    status: "success",
  });

  return ok(
    c,
    {
      message: `Account for ${name} provisioned successfully`,
      user_id: newUserId,
      role,
      identifier,
    },
    201,
  );
});

export default app;
