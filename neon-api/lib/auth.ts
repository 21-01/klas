import type { Context } from "hono";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { env } from "./env.ts";
import { one } from "./db.ts";
import { forbidden, unauthorized } from "./http.ts";

export type AppRole = "mahasiswa" | "dosen" | "admin" | "super_admin" | "admin_prodi";

export const ADMIN_ROLES: AppRole[] = ["admin", "super_admin", "admin_prodi"];

export interface AppUser {
  userId: string;
  email: string;
  name: string;
  role: AppRole;
  /** mahasiswa_id / dosen_id when the caller has a profile row. */
  mahasiswaId: string | null;
  dosenId: string | null;
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks() {
  if (!jwks) jwks = createRemoteJWKSet(new URL(env.jwksUrl));
  return jwks;
}

/** Verifies the Authorization bearer token and returns the JWT payload. */
export async function verifyBearer(c: Context): Promise<JWTPayload & { sub: string }> {
  const header = c.req.header("authorization") ?? c.req.header("Authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) throw unauthorized("Missing Authorization header");
  const token = header.slice(7).trim();
  try {
    const { payload } = await jwtVerify(token, getJwks(), {
      issuer: new URL(env.authBaseUrl).origin,
    });
    if (!payload.sub) throw unauthorized("Invalid user token");
    return payload as JWTPayload & { sub: string };
  } catch (error) {
    if ((error as Error).message?.includes("Invalid user token")) throw error;
    throw unauthorized("Invalid user token");
  }
}

/** Loads the caller's profile from public.users, with linked student/lecturer ids. */
export async function currentUser(c: Context): Promise<AppUser> {
  const payload = await verifyBearer(c);
  const cached = (c as unknown as { get: (k: string) => unknown }).get("appUser") as AppUser | undefined;
  if (cached) return cached;

  const row = await one<{
    user_id: string;
    email: string;
    name: string;
    role: AppRole;
    is_active: boolean;
    mahasiswa_id: string | null;
    dosen_id: string | null;
  }>(
    `select u.user_id, u.email, u.name, u.role, u.is_active,
            m.mahasiswa_id, d.dosen_id
       from users u
       left join mahasiswa m on m.user_id = u.user_id
       left join dosen d on d.user_id = u.user_id
      where u.user_id = $1`,
    [payload.sub],
  );
  if (!row) throw unauthorized("User profile not found");
  if (!row.is_active) throw forbidden("Account is inactive");

  const user: AppUser = {
    userId: row.user_id,
    email: row.email,
    name: row.name,
    role: row.role,
    mahasiswaId: row.mahasiswa_id,
    dosenId: row.dosen_id,
  };
  (c as unknown as { set: (k: string, v: unknown) => void }).set("appUser", user);
  return user;
}

/** Requires the caller to hold one of `roles`. */
export async function requireRole(c: Context, roles: AppRole[]): Promise<AppUser> {
  const user = await currentUser(c);
  if (!roles.includes(user.role)) throw forbidden(`Forbidden: requires role ${roles.join("|")}`);
  return user;
}

/** Requires an admin-tier role. */
export function requireAdmin(c: Context): Promise<AppUser> {
  return requireRole(c, ADMIN_ROLES);
}

/** True when the caller is an admin (bypasses ownership checks). */
export function isAdmin(user: AppUser): boolean {
  return ADMIN_ROLES.includes(user.role);
}

/**
 * Ownership guard for a session row: admins pass, lecturers must own the schedule.
 * Returns the session row so callers do not re-query it.
 */
export async function assertSessionAccess(
  user: AppUser,
  sesiId: string,
): Promise<{
  sesi_id: string;
  jadwal_id: string;
  status: string;
  dosen_id: string;
  geofence_radius_m: number;
  qr_rotates_every: number;
  jadwal_kelas?: Record<string, any>;
}> {
  const row = await one<any>(
    `select s.sesi_id, s.jadwal_id, s.status, s.tanggal, s.waktu_mulai, s.waktu_selesai,
            s.geofence_radius_m, s.qr_rotates_every, s.qr_seed,
            j.jadwal_id as j_jadwal_id, j.dosen_id, j.ruangan_id, j.hari,
            j.waktu_mulai as j_waktu_mulai, j.waktu_selesai as j_waktu_selesai,
            j.semester, j.tahun_akademik
       from sesi_kehadiran s
       join jadwal_kelas j on j.jadwal_id = s.jadwal_id
      where s.sesi_id = $1`,
    [sesiId],
  );
  if (!row) throw new HttpError(404, "Session not found");
  if (!isAdmin(user)) {
    if (!user.dosenId || row.dosen_id !== user.dosenId) {
      throw forbidden("Forbidden: you do not own this session");
    }
  }
  return row;
}

/** Ownership guard for a schedule row (lecturer must teach it). */
export async function assertJadwalAccess(user: AppUser, jadwalId: string) {
  const row = await one<any>(`select * from jadwal_kelas where jadwal_id = $1`, [jadwalId]);
  if (!row) throw new HttpError(404, "Schedule not found");
  if (!isAdmin(user) && row.dosen_id !== user.dosenId) {
    throw forbidden("Forbidden: you do not own this course");
  }
  return row;
}

/** Client IP, matching the old edge-function precedence. */
export function getClientIp(c: Context): string {
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return c.req.header("cf-connecting-ip") || "127.0.0.1";
}

// Re-exported to keep route files importing from one place.
import { HttpError } from "./http.ts";
