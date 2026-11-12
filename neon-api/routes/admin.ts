import { Hono, type Context } from "hono";
import { z } from "zod";
import { uuid as uuidSchema } from "../lib/ids.ts";
import { many, one, run, transaction, isUniqueViolation } from "../lib/db.ts";
import { badRequest, conflict, notFound, ok, text } from "../lib/http.ts";
import { getClientIp, requireAdmin, type AppUser } from "../lib/auth.ts";
import { audit, type AuditCategory } from "../lib/audit.ts";
import { lastNDates, paginate, round2, toCsv } from "../lib/util.ts";
import { signUpWithPassword } from "../lib/neon-auth.ts";

const app = new Hono();

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

async function readBody(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    throw badRequest("Invalid JSON body");
  }
}

function parse<S extends z.ZodType>(schema: S, value: unknown): z.infer<S> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw badRequest(result.error.issues[0]?.message ?? "Invalid request body");
  }
  return result.data;
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  return Number(value);
}

function mapMahasiswa<T extends Record<string, any>>(row: T): T {
  return { ...row, gpa: numberOrNull(row.gpa) };
}

function mapRuangan<T extends Record<string, any>>(row: T): T {
  return {
    ...row,
    latitude: numberOrNull(row.latitude),
    longitude: numberOrNull(row.longitude),
  };
}

function csvTimestamp(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return value === null || value === undefined ? "" : String(value);
}

async function logAudit(
  c: Context,
  user: AppUser,
  kategori: AuditCategory,
  aksi: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await audit({
    userId: user.userId,
    kategori,
    aksi,
    ip: getClientIp(c),
    status: "success",
    metadata: metadata ?? null,
  });
}

/** Builds `col = $n` assignments from a fixed column allowlist. */
function buildUpdate(fields: Record<string, unknown>, allowed: readonly string[]) {
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const column of allowed) {
    if (fields[column] !== undefined) {
      params.push(fields[column]);
      sets.push(`${column} = $${params.length}`);
    }
  }
  return { sets, params };
}

function compact<T extends Record<string, unknown>>(value: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined));
}

async function deleteAuthUserBestEffort(userId: string): Promise<void> {
  try {
    await run(`delete from neon_auth."user" where id = $1`, [userId]);
  } catch (error) {
    console.error("[admin] failed to delete auth user", userId, (error as Error).message);
  }
}

/* -------------------------------------------------------------------------- */
/* Shared schemas                                                             */
/* -------------------------------------------------------------------------- */

const uuid = uuidSchema("Invalid UUID");

const mahasiswaListSchema = z.object({
  action: z.literal("list"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().optional(),
  prodi_id: z.coerce.number().int().optional(),
  angkatan: z.string().optional(),
  is_active: z.boolean().optional(),
});

const mahasiswaGetSchema = z.object({
  action: z.literal("get"),
  mahasiswa_id: uuid,
});

const mahasiswaCreateSchema = z.object({
  action: z.literal("create"),
  nim: z.string().min(1).max(30),
  nama: z.string().min(1).max(150),
  prodi_id: z.coerce.number().int(),
  angkatan: z.string().max(4).optional().nullable(),
  jenis_kelamin: z.enum(["L", "P"]).optional().nullable(),
  gpa: z.coerce.number().max(9.99).optional().nullable(),
  pembimbing_akademik: z.string().max(150).optional().nullable(),
  email: z.email().optional(),
  password: z.string().min(6).optional(),
});

const mahasiswaUpdateSchema = z.object({
  action: z.literal("update"),
  mahasiswa_id: uuid,
  nim: z.string().min(1).max(30).optional(),
  nama: z.string().min(1).max(150).optional(),
  prodi_id: z.coerce.number().int().optional(),
  angkatan: z.string().max(4).optional().nullable(),
  jenis_kelamin: z.enum(["L", "P"]).optional().nullable(),
  gpa: z.coerce.number().max(9.99).optional().nullable(),
  pembimbing_akademik: z.string().max(150).optional().nullable(),
  is_active: z.boolean().optional(),
  email: z.email().optional(),
  password: z.string().min(6).optional(),
});

const mahasiswaDeleteSchema = z.object({
  action: z.literal("delete"),
  mahasiswa_id: uuid,
});

const mahasiswaActionSchema = z.discriminatedUnion("action", [
  mahasiswaListSchema,
  mahasiswaGetSchema,
  mahasiswaCreateSchema,
  mahasiswaUpdateSchema,
  mahasiswaDeleteSchema,
]);

const dosenListSchema = z.object({
  action: z.literal("list"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
  prodi_id: z.coerce.number().int().optional(),
  is_active: z.boolean().optional(),
});

const dosenGetSchema = z.object({ action: z.literal("get"), dosen_id: uuid });

const dosenCreateSchema = z.object({
  action: z.literal("create"),
  nip: z.string().max(30).optional().nullable(),
  nidn: z.string().max(30).optional().nullable(),
  nama: z.string().min(1, "Nama is required").max(150),
  prodi_id: z.coerce.number().int("Program studi ID is required"),
  jenis_kelamin: z.enum(["L", "P"]).optional().nullable(),
  email: z.email("Invalid email").optional().nullable(),
  password: z.string().min(8, "Password must be at least 8 characters").optional().nullable(),
});

const dosenUpdateSchema = z.object({
  action: z.literal("update"),
  dosen_id: uuid,
  nip: z.string().max(30).optional().nullable(),
  nidn: z.string().max(30).optional().nullable(),
  nama: z.string().max(150).optional(),
  prodi_id: z.coerce.number().int().optional(),
  jenis_kelamin: z.enum(["L", "P"]).optional().nullable(),
  is_active: z.boolean().optional(),
  email: z.email().optional().nullable(),
  password: z.string().min(6).optional().nullable(),
});

const dosenDeleteSchema = z.object({ action: z.literal("delete"), dosen_id: uuid });

const dosenActionSchema = z.union([
  dosenListSchema,
  dosenGetSchema,
  dosenCreateSchema,
  dosenUpdateSchema,
  dosenDeleteSchema,
]);

const mataKuliahListSchema = z.object({
  action: z.literal("list"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  prodi_id: z.coerce.number().int().optional(),
  sks: z.coerce.number().int().min(1).max(6).optional(),
  is_active: z.boolean().optional(),
});

const mataKuliahGetSchema = z.object({ action: z.literal("get"), mk_id: uuid });

const mataKuliahCreateSchema = z.object({
  action: z.literal("create"),
  kode_mk: z.string().min(1).max(20),
  nama_mk: z.string().min(1).max(200),
  sks: z.coerce.number().int().min(1).max(6),
  prodi_id: z.coerce.number().int(),
});

const mataKuliahUpdateSchema = z.object({
  action: z.literal("update"),
  mk_id: uuid,
  kode_mk: z.string().min(1).max(20).optional(),
  nama_mk: z.string().min(1).max(200).optional(),
  sks: z.coerce.number().int().min(1).max(6).optional(),
  prodi_id: z.coerce.number().int().optional(),
  is_active: z.boolean().optional(),
});

const mataKuliahDeleteSchema = z.object({ action: z.literal("delete"), mk_id: uuid });

const mataKuliahActionSchema = z.discriminatedUnion("action", [
  mataKuliahListSchema,
  mataKuliahGetSchema,
  mataKuliahCreateSchema,
  mataKuliahUpdateSchema,
  mataKuliahDeleteSchema,
]);

const hariEnum = z.enum(["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"]);

const jadwalListSchema = z.object({
  action: z.literal("list"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  semester: z.string().optional(),
  tahun_akademik: z.string().optional(),
  hari: hariEnum.optional(),
  prodi_id: z.coerce.number().int().optional(),
  dosen_id: uuid.optional(),
  ruangan_id: uuid.optional(),
  status: z.enum(["assigned", "unassigned", "room-missing"]).optional(),
});

const jadwalGetSchema = z.object({ action: z.literal("get"), jadwal_id: uuid });

const jadwalCreateSchema = z.object({
  action: z.literal("create"),
  mk_id: uuid,
  dosen_id: uuid.optional().nullable(),
  ruangan_id: uuid.optional().nullable(),
  hari: hariEnum,
  waktu_mulai: z.string(),
  waktu_selesai: z.string(),
  semester: z.string(),
  tahun_akademik: z.string(),
  quota: z.coerce.number().int().min(0).optional(),
});

const jadwalUpdateSchema = z.object({
  action: z.literal("update"),
  jadwal_id: uuid,
  mk_id: uuid.optional(),
  dosen_id: uuid.optional().nullable(),
  ruangan_id: uuid.optional().nullable(),
  hari: hariEnum.optional(),
  waktu_mulai: z.string().optional(),
  waktu_selesai: z.string().optional(),
  semester: z.string().optional(),
  tahun_akademik: z.string().optional(),
  quota: z.coerce.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
});

const jadwalDeleteSchema = z.object({ action: z.literal("delete"), jadwal_id: uuid });

const jadwalListEnrolledSchema = z.object({
  action: z.literal("list-enrolled"),
  jadwal_id: uuid,
});

const jadwalToggleEnrollSchema = z.object({
  action: z.literal("toggle-enroll"),
  jadwal_id: uuid,
  mahasiswa_id: uuid,
});

const jadwalActionSchema = z.union([
  jadwalListSchema,
  jadwalGetSchema,
  jadwalCreateSchema,
  jadwalUpdateSchema,
  jadwalDeleteSchema,
  jadwalListEnrolledSchema,
  jadwalToggleEnrollSchema,
]);

const ruanganListSchema = z.object({
  action: z.literal("list"),
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
  is_active: z.boolean().optional(),
  kapasitas_min: z.coerce.number().int().min(1).optional(),
  kapasitas_max: z.coerce.number().int().min(1).optional(),
});

const ruanganGetSchema = z.object({ action: z.literal("get"), ruangan_id: uuid });

const ruanganCreateSchema = z.object({
  action: z.literal("create"),
  kode_ruangan: z.string().max(30),
  nama_ruangan: z.string().max(150),
  kapasitas: z.number().int().positive().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  geofence_radius_m: z.number().int().positive().default(50),
});

const ruanganUpdateSchema = z.object({
  action: z.literal("update"),
  ruangan_id: uuid,
  kode_ruangan: z.string().max(30).optional(),
  nama_ruangan: z.string().max(150).optional(),
  kapasitas: z.number().int().positive().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  geofence_radius_m: z.number().int().positive().optional(),
});

const ruanganDeleteSchema = z.object({ action: z.literal("delete"), ruangan_id: uuid });

const ruanganActionSchema = z.discriminatedUnion("action", [
  ruanganListSchema,
  ruanganGetSchema,
  ruanganCreateSchema,
  ruanganUpdateSchema,
  ruanganDeleteSchema,
]);

const prodiListSchema = z.object({ action: z.literal("list"), search: z.string().optional() });
const prodiGetSchema = z.object({ action: z.literal("get"), prodi_id: z.coerce.number().int().positive() });
const prodiCreateSchema = z.object({
  action: z.literal("create"),
  kode_prodi: z.string().min(1, "kode_prodi is required").max(20),
  nama_prodi: z.string().min(1, "nama_prodi is required").max(150),
});
const prodiUpdateSchema = z.object({
  action: z.literal("update"),
  prodi_id: z.coerce.number().int().positive(),
  kode_prodi: z.string().min(1).max(20).optional(),
  nama_prodi: z.string().min(1).max(150).optional(),
});
const prodiDeleteSchema = z.object({
  action: z.literal("delete"),
  prodi_id: z.coerce.number().int().positive(),
});

const prodiActionSchema = z.discriminatedUnion("action", [
  prodiListSchema,
  prodiGetSchema,
  prodiCreateSchema,
  prodiUpdateSchema,
  prodiDeleteSchema,
]);

/* -------------------------------------------------------------------------- */
/* Dashboard                                                                  */
/* -------------------------------------------------------------------------- */

app.post("/get-admin-dashboard", async (c) => {
  await requireAdmin(c);

  const today = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const dates = lastNDates(7);

  const counts = await one<{
    total_students: number;
    total_lecturers: number;
    total_courses: number;
    total_rooms: number;
    active_sessions_today: number;
    completed_sessions_today: number;
    total_sessions_all_time: number;
    total_enrollments: number;
    geofence_violations: number;
    total_presensi: number;
    present_presensi: number;
  }>(
    `select
       (select count(*)::int from mahasiswa where is_active) as total_students,
       (select count(*)::int from dosen where is_active) as total_lecturers,
       (select count(*)::int from mata_kuliah where is_active) as total_courses,
       (select count(*)::int from ruangan where is_active) as total_rooms,
       (select count(*)::int from sesi_kehadiran where status = 'live' and tanggal = $1::date) as active_sessions_today,
       (select count(*)::int from sesi_kehadiran where status = 'completed' and tanggal = $1::date) as completed_sessions_today,
       (select count(*)::int from sesi_kehadiran) as total_sessions_all_time,
       (select count(*)::int from pendaftaran_kelas) as total_enrollments,
       (select count(*)::int from presensi where geofence_flagged) as geofence_violations,
       (select count(*)::int from presensi) as total_presensi,
       (select count(*)::int from presensi where status in ('present', 'late', 'excused')) as present_presensi`,
    [today],
  );

  const low = await one<{ total: number }>(
    `select count(*)::int as total
       from (
         select mahasiswa_id,
                count(*) as total,
                count(*) filter (where status in ('present', 'late', 'excused')) as present
           from presensi
          group by mahasiswa_id
       ) t
      where t.total > 0 and t.present::numeric / t.total < 0.75`,
  );

  const trendRows = await many<{ date: string; present_count: number; absent_count: number }>(
    `select s.tanggal::text as date,
            count(*) filter (where p.status in ('present', 'late', 'excused'))::int as present_count,
            count(*) filter (where p.status = 'absent')::int as absent_count
       from presensi p
       join sesi_kehadiran s on s.sesi_id = p.sesi_id
      where s.tanggal = any($1::date[])
      group by s.tanggal`,
    [dates],
  );
  const trendMap = new Map(trendRows.map((row) => [row.date, row]));
  const attendance_trend = dates.map((date) => {
    const row = trendMap.get(date);
    return {
      date,
      present_count: row?.present_count ?? 0,
      absent_count: row?.absent_count ?? 0,
    };
  });

  const totalPresensi = counts?.total_presensi ?? 0;
  const presentPresensi = counts?.present_presensi ?? 0;

  return ok(c, {
    total_students: counts?.total_students ?? 0,
    total_lecturers: counts?.total_lecturers ?? 0,
    total_courses: counts?.total_courses ?? 0,
    total_rooms: counts?.total_rooms ?? 0,
    active_sessions_today: counts?.active_sessions_today ?? 0,
    completed_sessions_today: counts?.completed_sessions_today ?? 0,
    total_sessions_all_time: counts?.total_sessions_all_time ?? 0,
    total_enrollments: counts?.total_enrollments ?? 0,
    overall_attendance_rate: totalPresensi > 0 ? round2((presentPresensi / totalPresensi) * 100) : 0,
    students_with_low_attendance: low?.total ?? 0,
    attendance_trend,
    geofence_violations: counts?.geofence_violations ?? 0,
  });
});

/* -------------------------------------------------------------------------- */
/* Global attendance                                                          */
/* -------------------------------------------------------------------------- */

const globalAttendanceSchema = z.object({
  status: z.enum(["live", "completed", "scheduled"]).optional(),
  tanggal: z.string().optional(),
  jadwal_id: uuid.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

app.post("/get-global-attendance", async (c) => {
  await requireAdmin(c);
  const query = parse(globalAttendanceSchema, await readBody(c));

  const where: string[] = [];
  const params: unknown[] = [];
  if (query.status) {
    params.push(query.status);
    where.push(`s.status = $${params.length}::status_sesi_enum`);
  }
  if (query.tanggal) {
    params.push(query.tanggal);
    where.push(`s.tanggal = $${params.length}::date`);
  }
  if (query.jadwal_id) {
    params.push(query.jadwal_id);
    where.push(`s.jadwal_id = $${params.length}`);
  }
  const whereSql = where.length ? `where ${where.join(" and ")}` : "";

  const countRow = await one<{ total: number }>(
    `select count(*)::int as total from sesi_kehadiran s ${whereSql}`,
    params,
  );
  const total = countRow?.total ?? 0;
  const { pagination, offset } = paginate(query.page, query.limit, total);

  if (total === 0) return ok(c, { sessions: [], pagination });

  const dataParams = [...params, query.limit, offset];
  const sessions = await many<Record<string, any>>(
    `select s.sesi_id, s.jadwal_id, s.tanggal::text as tanggal,
            s.waktu_mulai, s.waktu_selesai, s.status,
            mk.kode_mk, mk.nama_mk,
            d.nama as dosen_nama,
            r.nama_ruangan
       from sesi_kehadiran s
       join jadwal_kelas j on j.jadwal_id = s.jadwal_id
       join mata_kuliah mk on mk.mk_id = j.mk_id
       left join dosen d on d.dosen_id = j.dosen_id
       left join ruangan r on r.ruangan_id = j.ruangan_id
       ${whereSql}
      order by s.tanggal desc, s.waktu_mulai desc
      limit $${params.length + 1} offset $${params.length + 2}`,
    dataParams,
  );

  const sesiIds = sessions.map((row) => row.sesi_id);
  const jadwalIds = [...new Set(sessions.map((row) => row.jadwal_id))];

  const [enrolledRows, attendanceRows] = await Promise.all([
    many<{ jadwal_id: string; total: number }>(
      `select jadwal_id, count(*)::int as total
         from pendaftaran_kelas
        where jadwal_id = any($1::uuid[])
        group by jadwal_id`,
      [jadwalIds],
    ),
    many<{ sesi_id: string; status: string; total: number }>(
      `select sesi_id, status::text as status, count(*)::int as total
         from presensi
        where sesi_id = any($1::uuid[])
        group by sesi_id, status`,
      [sesiIds],
    ),
  ]);

  const enrolledMap = new Map(enrolledRows.map((row) => [row.jadwal_id, row.total]));
  const attendanceMap = new Map<string, { present: number; absent: number; excused: number; late: number }>();
  for (const row of attendanceRows) {
    const entry = attendanceMap.get(row.sesi_id) ?? { present: 0, absent: 0, excused: 0, late: 0 };
    if (row.status === "present") entry.present += row.total;
    else if (row.status === "absent") entry.absent += row.total;
    else if (row.status === "excused") entry.excused += row.total;
    else if (row.status === "late") entry.late += row.total;
    attendanceMap.set(row.sesi_id, entry);
  }

  const result = sessions.map((row) => {
    const counts = attendanceMap.get(row.sesi_id) ?? { present: 0, absent: 0, excused: 0, late: 0 };
    const enrolledCount = enrolledMap.get(row.jadwal_id) ?? 0;
    const totalAttendance = counts.present + counts.absent + counts.excused + counts.late;
    return {
      sesi_id: row.sesi_id,
      tanggal: row.tanggal,
      waktu_mulai: row.waktu_mulai,
      waktu_selesai: row.waktu_selesai,
      status: row.status,
      mata_kuliah: { kode_mk: row.kode_mk, nama_mk: row.nama_mk },
      dosen: { nama: row.dosen_nama },
      ruangan: { nama_ruangan: row.nama_ruangan },
      enrolled_count: enrolledCount,
      attendance_counts: {
        present: counts.present,
        absent: counts.absent,
        excused: counts.excused,
        late: counts.late,
        total: totalAttendance,
      },
      attendance_rate: enrolledCount > 0 ? round2(((counts.present + counts.late) / enrolledCount) * 100) : 0,
    };
  });

  return ok(c, { sessions: result, pagination });
});

/* -------------------------------------------------------------------------- */
/* Attendance courses                                                         */
/* -------------------------------------------------------------------------- */

app.post("/get-admin-attendance-courses", async (c) => {
  const user = await requireAdmin(c);

  // The canonical schema stores prodi membership on dosen/mahasiswa, not users.
  let prodiId: number | null = null;
  if (user.role === "admin_prodi") {
    const row = await one<{ prodi_id: number }>(`select prodi_id from dosen where user_id = $1`, [user.userId]);
    prodiId = row ? Number(row.prodi_id) : null;
  }

  const params: unknown[] = [];
  let prodiFilter = "";
  if (prodiId !== null) {
    params.push(prodiId);
    prodiFilter = `where mk.prodi_id = $${params.length}`;
  }

  const rows = await many<Record<string, any>>(
    `select j.jadwal_id, j.hari, j.waktu_mulai, j.waktu_selesai, j.semester,
            mk.mk_id, mk.kode_mk, mk.nama_mk, mk.sks,
            d.dosen_id, d.nama as dosen_nama,
            (select count(*)::int from pendaftaran_kelas p where p.jadwal_id = j.jadwal_id) as enrolled,
            ls.sesi_id, ls.status as sesi_status, ls.tanggal::text as sesi_tanggal
       from jadwal_kelas j
       join mata_kuliah mk on mk.mk_id = j.mk_id
       join dosen d on d.dosen_id = j.dosen_id
       left join lateral (
         select s.sesi_id, s.status, s.tanggal
           from sesi_kehadiran s
          where s.jadwal_id = j.jadwal_id
          order by s.waktu_mulai desc nulls last, s.created_at desc
          limit 1
       ) ls on true
       ${prodiFilter}
      order by mk.kode_mk asc`,
    params,
  );

  return ok(c, {
    courses: rows.map((row) => ({
      jadwal_id: row.jadwal_id,
      mata_kuliah: {
        mk_id: row.mk_id,
        kode_mk: row.kode_mk,
        nama_mk: row.nama_mk,
        sks: row.sks,
      },
      dosen: { dosen_id: row.dosen_id, nama: row.dosen_nama },
      hari: row.hari,
      waktu_mulai: row.waktu_mulai,
      waktu_selesai: row.waktu_selesai,
      semester: row.semester,
      ruangan: null,
      enrolled: row.enrolled ?? 0,
      latest_session: row.sesi_id
        ? { sesi_id: row.sesi_id, status: row.sesi_status, tanggal: row.sesi_tanggal }
        : null,
    })),
  });
});

/* -------------------------------------------------------------------------- */
/* Audit logs                                                                 */
/* -------------------------------------------------------------------------- */

const auditLogSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  kategori: z
    .enum([
      "Master Data",
      "Schedule Plotting",
      "Security Policies",
      "Attendance Overrides",
      "Authentication",
      "Geofence",
      "System",
    ])
    .optional(),
  status: z.enum(["success", "failed"]).optional(),
  search: z.string().optional(),
  from_date: z.string().optional(),
  to_date: z.string().optional(),
  user_id: uuid.optional(),
  format: z.enum(["json", "csv"]).default("json"),
});

app.post("/get-audit-logs", async (c) => {
  await requireAdmin(c);
  const query = parse(auditLogSchema, await readBody(c));

  const where: string[] = [];
  const params: unknown[] = [];
  if (query.kategori) {
    params.push(query.kategori);
    where.push(`a.kategori = $${params.length}::kategori_audit_enum`);
  }
  if (query.status) {
    params.push(query.status);
    where.push(`a.status = $${params.length}::status_audit_enum`);
  }
  if (query.search) {
    params.push(`%${query.search}%`);
    where.push(`a.aksi ilike $${params.length}`);
  }
  if (query.from_date) {
    params.push(query.from_date);
    where.push(`a.timestamp >= $${params.length}::date`);
  }
  if (query.to_date) {
    params.push(query.to_date);
    where.push(`a.timestamp < ($${params.length}::date + interval '1 day')`);
  }
  if (query.user_id) {
    params.push(query.user_id);
    where.push(`a.user_id = $${params.length}`);
  }
  const whereSql = where.length ? `where ${where.join(" and ")}` : "";

  if (query.format === "csv") {
    const rows = await many<Record<string, any>>(
      `select a.log_id, a.user_id, a.timestamp, a.kategori, a.aksi, a.ip_address, a.status,
              a.metadata, a.created_at,
              u.name as user_name, u.email as user_email
         from audit_log a
         left join users u on u.user_id = a.user_id
         ${whereSql}
        order by a.timestamp desc`,
      params,
    );
    const csv = toCsv(
      ["Timestamp", "User", "Email", "Kategori", "Aksi", "IP Address", "Status"],
      rows.map((row) => [
        csvTimestamp(row.timestamp),
        row.user_name ?? "",
        row.user_email ?? "",
        row.kategori ?? "",
        row.aksi ?? "",
        row.ip_address ?? "",
        row.status ?? "",
      ]),
    );
    return text(c, csv, "audit-logs.csv");
  }

  const countRow = await one<{ total: number }>(
    `select count(*)::int as total from audit_log a ${whereSql}`,
    params,
  );
  const total = countRow?.total ?? 0;
  const { pagination, offset } = paginate(query.page, query.limit, total);

  const dataParams = [...params, query.limit, offset];
  const rows = await many<Record<string, any>>(
    `select a.log_id, a.user_id, a.timestamp, a.kategori, a.aksi, a.ip_address, a.status,
            a.metadata, a.created_at,
            u.name as user_name, u.email as user_email
       from audit_log a
       left join users u on u.user_id = a.user_id
       ${whereSql}
      order by a.timestamp desc
      limit $${params.length + 1} offset $${params.length + 2}`,
    dataParams,
  );

  return ok(c, {
    logs: rows.map((row) => ({
      log_id: row.log_id,
      user_id: row.user_id,
      timestamp: row.timestamp,
      kategori: row.kategori,
      aksi: row.aksi,
      ip_address: row.ip_address,
      status: row.status,
      metadata: row.metadata,
      created_at: row.created_at,
      user:
        row.user_name === null && row.user_email === null
          ? null
          : { name: row.user_name, email: row.user_email },
    })),
    pagination,
  });
});

/* -------------------------------------------------------------------------- */
/* CRUD: mahasiswa                                                            */
/* -------------------------------------------------------------------------- */

app.post("/crud-mahasiswa", async (c) => {
  const user = await requireAdmin(c);
  const raw = await readBody(c);
  const data = parse(mahasiswaActionSchema, raw);

  if (data.action === "list") {
    const where: string[] = [];
    const params: unknown[] = [];
    if (data.search) {
      params.push(`%${data.search}%`);
      where.push(`(m.nim ilike $${params.length} or m.nama ilike $${params.length})`);
    }
    if (data.prodi_id !== undefined) {
      params.push(data.prodi_id);
      where.push(`m.prodi_id = $${params.length}`);
    }
    if (data.angkatan !== undefined) {
      params.push(data.angkatan);
      where.push(`m.angkatan = $${params.length}`);
    }
    if (data.is_active !== undefined) {
      params.push(data.is_active);
      where.push(`m.is_active = $${params.length}`);
    }
    const whereSql = where.length ? `where ${where.join(" and ")}` : "";

    const countRow = await one<{ total: number }>(
      `select count(*)::int as total from mahasiswa m ${whereSql}`,
      params,
    );
    const total = countRow?.total ?? 0;
    const { pagination, offset } = paginate(data.page, data.limit, total);

    const rows = await many<Record<string, any>>(
      `select m.*, ps.nama_prodi, u.email as user_email
         from mahasiswa m
         join program_studi ps on ps.prodi_id = m.prodi_id
         left join users u on u.user_id = m.user_id
         ${whereSql}
        order by m.created_at desc
        limit $${params.length + 1} offset $${params.length + 2}`,
      [...params, data.limit, offset],
    );

    return ok(c, {
      mahasiswa: rows.map((row) => {
        const { nama_prodi, user_email, ...rest } = row;
        return {
          ...mapMahasiswa(rest),
          program_studi: nama_prodi ? { nama_prodi } : null,
          users: user_email ? { email: user_email } : null,
        };
      }),
      pagination,
    });
  }

  if (data.action === "get") {
    const row = await one<Record<string, any>>(
      `select m.*, ps.prodi_id as ps_prodi_id, ps.kode_prodi, ps.nama_prodi
         from mahasiswa m
         join program_studi ps on ps.prodi_id = m.prodi_id
        where m.mahasiswa_id = $1`,
      [data.mahasiswa_id],
    );
    if (!row) throw notFound("Mahasiswa not found");
    const { ps_prodi_id, kode_prodi, nama_prodi, ...rest } = row;
    return ok(c, {
      ...mapMahasiswa(rest),
      prodi: { prodi_id: ps_prodi_id, kode_prodi, nama_prodi },
    });
  }

  if (data.action === "create") {
    const { action: _action, email, password, ...fields } = data;
    if (!email || !password) {
      throw badRequest("email and password are required to create a student account");
    }

    let authUserId: string | null = null;
    let created: Record<string, any>;
    try {
      const auth = await signUpWithPassword(email, password, fields.nama);
      authUserId = auth.user.id;
      const userId = authUserId;

      created = await transaction(async (client) => {
        await client.query(
          `insert into users (user_id, email, name, role) values ($1, $2, $3, 'mahasiswa')`,
          [userId, email, fields.nama],
        );
        const result = await client.query(
          `insert into mahasiswa
             (user_id, nim, nama, prodi_id, angkatan, jenis_kelamin, gpa, pembimbing_akademik)
           values ($1, $2, $3, $4, $5, $6, $7, $8)
           returning *`,
          [
            userId,
            fields.nim,
            fields.nama,
            fields.prodi_id,
            fields.angkatan ?? null,
            fields.jenis_kelamin ?? null,
            fields.gpa ?? null,
            fields.pembimbing_akademik ?? null,
          ],
        );
        return result.rows[0];
      });
    } catch (error) {
      if (authUserId) await deleteAuthUserBestEffort(authUserId);
      if (isUniqueViolation(error)) throw conflict("NIM or email already exists");
      throw error;
    }

    await logAudit(c, user, "Master Data", `Created mahasiswa ${created.nim} - ${created.nama}`);
    return ok(c, mapMahasiswa(created), 201);
  }

  if (data.action === "update") {
    const { action: _action, mahasiswa_id, email, password, ...rawFields } = data;
    const fields = compact(rawFields);

    const existing = await one<{ mahasiswa_id: string; nama: string; user_id: string }>(
      `select mahasiswa_id, nama, user_id from mahasiswa where mahasiswa_id = $1`,
      [mahasiswa_id],
    );
    if (!existing) throw notFound("Mahasiswa not found");

    let linkedUserId = existing.user_id;
    let newAuthUserId: string | null = null;
    const { sets, params } = buildUpdate(fields, [
      "nim",
      "nama",
      "prodi_id",
      "angkatan",
      "jenis_kelamin",
      "gpa",
      "pembimbing_akademik",
      "is_active",
    ]);

    if (Object.keys(fields).length === 0 && !email) {
      throw badRequest("No fields to update");
    }

    try {
      if (email || password) {
        if (linkedUserId) {
          if (email) {
            await run(`update users set email = $1 where user_id = $2`, [email, linkedUserId]);
          }
          // Password changes for an existing Neon Auth user are handled by
          // /change-password; there is no admin password-reset helper.
        } else if (email && password) {
          const name = typeof fields.nama === "string" ? fields.nama : existing.nama;
          const auth = await signUpWithPassword(email, password, name);
          newAuthUserId = auth.user.id;
          linkedUserId = newAuthUserId;
          await run(`insert into users (user_id, email, name, role) values ($1, $2, $3, 'mahasiswa')`, [
            newAuthUserId,
            email,
            name,
          ]);
          params.push(linkedUserId);
          sets.push(`user_id = $${params.length}`);
        }
      }

      if (sets.length > 0) {
        params.push(mahasiswa_id);
        const result = await run(
          `update mahasiswa set ${sets.join(", ")} where mahasiswa_id = $${params.length} returning *`,
          params,
        );
        const updated = result.rows[0] as Record<string, any>;
        await logAudit(c, user, "Master Data", `Updated mahasiswa ${mahasiswa_id}`);
        return ok(c, mapMahasiswa(updated));
      }

      const row = await one<Record<string, any>>(`select * from mahasiswa where mahasiswa_id = $1`, [mahasiswa_id]);
      await logAudit(c, user, "Master Data", `Updated mahasiswa ${mahasiswa_id}`);
      return ok(c, mapMahasiswa(row ?? {}));
    } catch (error) {
      if (newAuthUserId) await deleteAuthUserBestEffort(newAuthUserId);
      if (isUniqueViolation(error)) throw conflict("NIM or email already exists");
      throw error;
    }
  }

  // delete (soft)
  const existing = await one<{ mahasiswa_id: string; nim: string; nama: string }>(
    `select mahasiswa_id, nim, nama from mahasiswa where mahasiswa_id = $1`,
    [data.mahasiswa_id],
  );
  if (!existing) throw notFound("Mahasiswa not found");

  await run(`update mahasiswa set is_active = false where mahasiswa_id = $1`, [data.mahasiswa_id]);
  await logAudit(
    c,
    user,
    "Master Data",
    `Deleted (soft) mahasiswa ${existing.nim} - ${existing.nama}`,
  );
  return ok(c, { message: "Mahasiswa deactivated successfully" });
});

/* -------------------------------------------------------------------------- */
/* CRUD: dosen                                                                */
/* -------------------------------------------------------------------------- */

app.post("/crud-dosen", async (c) => {
  const user = await requireAdmin(c);
  const data = parse(dosenActionSchema, await readBody(c));

  if (data.action === "list") {
    const where: string[] = [];
    const params: unknown[] = [];
    if (data.search) {
      params.push(`%${data.search}%`);
      where.push(
        `(d.nama ilike $${params.length} or d.nip ilike $${params.length} or d.nidn ilike $${params.length})`,
      );
    }
    if (data.prodi_id !== undefined) {
      params.push(data.prodi_id);
      where.push(`d.prodi_id = $${params.length}`);
    }
    if (data.is_active !== undefined) {
      params.push(data.is_active);
      where.push(`d.is_active = $${params.length}`);
    }
    const whereSql = where.length ? `where ${where.join(" and ")}` : "";

    const countRow = await one<{ total: number }>(
      `select count(*)::int as total from dosen d ${whereSql}`,
      params,
    );
    const total = countRow?.total ?? 0;
    const offset = (data.page - 1) * data.limit;

    const rows = await many<Record<string, any>>(
      `select d.*, ps.nama_prodi, u.email as user_email
         from dosen d
         join program_studi ps on ps.prodi_id = d.prodi_id
         left join users u on u.user_id = d.user_id
         ${whereSql}
        order by d.nama asc
        limit $${params.length + 1} offset $${params.length + 2}`,
      [...params, data.limit, offset],
    );

    return ok(c, {
      data: rows.map((row) => {
        const { nama_prodi, user_email, ...rest } = row;
        return {
          ...rest,
          program_studi: nama_prodi ? { nama_prodi } : null,
          users: user_email ? { email: user_email } : null,
        };
      }),
      total,
      page: data.page,
      limit: data.limit,
    });
  }

  if (data.action === "get") {
    const row = await one<Record<string, any>>(
      `select d.*, ps.nama_prodi
         from dosen d
         join program_studi ps on ps.prodi_id = d.prodi_id
        where d.dosen_id = $1`,
      [data.dosen_id],
    );
    if (!row) throw notFound("Dosen not found");
    const { nama_prodi, ...rest } = row;
    return ok(c, { ...rest, program_studi: { nama_prodi } });
  }

  if (data.action === "create") {
    const { action: _action, email, password, ...fields } = data;
    if (!email || !password) {
      throw badRequest("email and password are required to create a lecturer account");
    }

    let authUserId: string | null = null;
    let created: Record<string, any>;
    try {
      const auth = await signUpWithPassword(email, password, fields.nama);
      authUserId = auth.user.id;
      const userId = authUserId;

      created = await transaction(async (client) => {
        await client.query(
          `insert into users (user_id, email, name, role) values ($1, $2, $3, 'dosen')`,
          [userId, email, fields.nama],
        );
        const result = await client.query(
          `insert into dosen (user_id, nip, nidn, nama, prodi_id, jenis_kelamin)
           values ($1, $2, $3, $4, $5, $6)
           returning *`,
          [
            userId,
            fields.nip ?? null,
            fields.nidn ?? null,
            fields.nama,
            fields.prodi_id,
            fields.jenis_kelamin ?? null,
          ],
        );
        return result.rows[0];
      });
    } catch (error) {
      if (authUserId) await deleteAuthUserBestEffort(authUserId);
      if (isUniqueViolation(error)) throw conflict("NIP, NIDN, or email already exists");
      throw error;
    }

    await logAudit(
      c,
      user,
      "Master Data",
      `Created dosen ${created.nama} (${created.nip || created.nidn || "N/A"})`,
    );
    return ok(c, created, 201);
  }

  if (data.action === "update") {
    const { action: _action, dosen_id, email, password, ...rawFields } = data;
    const fields = compact(rawFields);

    const existing = await one<{ dosen_id: string; nama: string; user_id: string }>(
      `select dosen_id, nama, user_id from dosen where dosen_id = $1`,
      [dosen_id],
    );
    if (!existing) throw notFound("Dosen not found");

    let linkedUserId = existing.user_id;
    let newAuthUserId: string | null = null;
    const { sets, params } = buildUpdate(fields, [
      "nip",
      "nidn",
      "nama",
      "prodi_id",
      "jenis_kelamin",
      "is_active",
    ]);

    if (Object.keys(fields).length === 0 && !email) {
      throw badRequest("No fields to update");
    }

    try {
      if (email || password) {
        if (linkedUserId) {
          if (email) {
            await run(`update users set email = $1 where user_id = $2`, [email, linkedUserId]);
          }
        } else if (email && password) {
          const name = typeof fields.nama === "string" ? fields.nama : existing.nama;
          const auth = await signUpWithPassword(email, password, name);
          newAuthUserId = auth.user.id;
          linkedUserId = newAuthUserId;
          await run(`insert into users (user_id, email, name, role) values ($1, $2, $3, 'dosen')`, [
            newAuthUserId,
            email,
            name,
          ]);
          params.push(linkedUserId);
          sets.push(`user_id = $${params.length}`);
        }
      }

      if (sets.length > 0) {
        params.push(dosen_id);
        const result = await run(
          `update dosen set ${sets.join(", ")} where dosen_id = $${params.length} returning *`,
          params,
        );
        const updated = result.rows[0] as Record<string, any>;
        await logAudit(c, user, "Master Data", `Updated dosen ${existing.nama} (${dosen_id})`);
        return ok(c, updated);
      }

      const row = await one<Record<string, any>>(`select * from dosen where dosen_id = $1`, [dosen_id]);
      await logAudit(c, user, "Master Data", `Updated dosen ${existing.nama} (${dosen_id})`);
      return ok(c, row ?? {});
    } catch (error) {
      if (newAuthUserId) await deleteAuthUserBestEffort(newAuthUserId);
      if (isUniqueViolation(error)) throw conflict("NIP, NIDN, or email already exists");
      throw error;
    }
  }

  // delete (soft)
  const existing = await one<{ nama: string }>(`select nama from dosen where dosen_id = $1`, [data.dosen_id]);
  if (!existing) throw notFound("Dosen not found");

  await run(`update dosen set is_active = false where dosen_id = $1`, [data.dosen_id]);
  await logAudit(c, user, "Master Data", `Soft-deleted dosen ${existing.nama} (${data.dosen_id})`);
  return ok(c, { message: "Dosen deactivated successfully" });
});

/* -------------------------------------------------------------------------- */
/* CRUD: mata kuliah                                                          */
/* -------------------------------------------------------------------------- */

app.post("/crud-mata-kuliah", async (c) => {
  const user = await requireAdmin(c);
  const data = parse(mataKuliahActionSchema, await readBody(c));

  if (data.action === "list") {
    const where: string[] = [];
    const params: unknown[] = [];
    if (data.search) {
      params.push(`%${data.search}%`);
      where.push(`(mk.kode_mk ilike $${params.length} or mk.nama_mk ilike $${params.length})`);
    }
    if (data.prodi_id !== undefined) {
      params.push(data.prodi_id);
      where.push(`mk.prodi_id = $${params.length}`);
    }
    if (data.sks !== undefined) {
      params.push(data.sks);
      where.push(`mk.sks = $${params.length}`);
    }
    if (data.is_active !== undefined) {
      params.push(data.is_active);
      where.push(`mk.is_active = $${params.length}`);
    }
    const whereSql = where.length ? `where ${where.join(" and ")}` : "";

    const countRow = await one<{ total: number }>(
      `select count(*)::int as total from mata_kuliah mk ${whereSql}`,
      params,
    );
    const total = countRow?.total ?? 0;
    const { pagination, offset } = paginate(data.page, data.limit, total);

    const rows = await many<Record<string, any>>(
      `select mk.*, ps.prodi_id as ps_prodi_id, ps.nama_prodi
         from mata_kuliah mk
         join program_studi ps on ps.prodi_id = mk.prodi_id
         ${whereSql}
        order by mk.kode_mk asc
        limit $${params.length + 1} offset $${params.length + 2}`,
      [...params, data.limit, offset],
    );

    return ok(c, {
      data: rows.map((row) => {
        const { ps_prodi_id, nama_prodi, ...rest } = row;
        return { ...rest, program_studi: { prodi_id: ps_prodi_id, nama_prodi } };
      }),
      pagination,
    });
  }

  if (data.action === "get") {
    const row = await one<Record<string, any>>(
      `select mk.*, ps.nama_prodi
         from mata_kuliah mk
         join program_studi ps on ps.prodi_id = mk.prodi_id
        where mk.mk_id = $1`,
      [data.mk_id],
    );
    if (!row) throw notFound("Mata kuliah not found");
    const { nama_prodi, ...rest } = row;
    return ok(c, { data: { ...rest, program_studi: { prodi_id: rest.prodi_id, nama_prodi } } });
  }

  if (data.action === "create") {
    try {
      const result = await run(
        `insert into mata_kuliah (kode_mk, nama_mk, sks, prodi_id)
         values ($1, $2, $3, $4) returning *`,
        [data.kode_mk, data.nama_mk, data.sks, data.prodi_id],
      );
      const row = result.rows[0] as Record<string, any>;
      await logAudit(c, user, "Master Data", `Created mata kuliah ${data.kode_mk} - ${data.nama_mk}`);
      return ok(c, { data: row, mk_id: row.mk_id }, 201);
    } catch (error) {
      if (isUniqueViolation(error)) throw conflict("Kode mata kuliah already exists");
      throw error;
    }
  }

  if (data.action === "update") {
    const { action: _action, mk_id, ...fields } = data;
    const { sets, params } = buildUpdate(fields, ["kode_mk", "nama_mk", "sks", "prodi_id", "is_active"]);
    if (sets.length === 0) throw badRequest("No fields to update");

    params.push(mk_id);
    try {
      const result = await run(
        `update mata_kuliah set ${sets.join(", ")} where mk_id = $${params.length} returning *`,
        params,
      );
      const row = result.rows[0] as Record<string, any> | undefined;
      if (!row) throw notFound("Mata kuliah not found");
      await logAudit(c, user, "Master Data", `Updated mata kuliah ${mk_id}`);
      return ok(c, { data: row, mk_id: row.mk_id });
    } catch (error) {
      if (isUniqueViolation(error)) throw conflict("Kode mata kuliah already exists");
      throw error;
    }
  }

  // delete (hard)
  const existing = await one<{ mk_id: string }>(`select mk_id from mata_kuliah where mk_id = $1`, [data.mk_id]);
  if (!existing) throw notFound("Mata kuliah not found");

  try {
    await run(`delete from mata_kuliah where mk_id = $1`, [data.mk_id]);
  } catch (error) {
    if ((error as { code?: string }).code === "23503") {
      throw conflict("Mata kuliah is still referenced by schedules");
    }
    throw error;
  }
  await logAudit(c, user, "Master Data", `Deleted mata kuliah ${data.mk_id}`);
  return ok(c, { message: "Mata kuliah deleted successfully", mk_id: data.mk_id });
});

/* -------------------------------------------------------------------------- */
/* CRUD: jadwal                                                               */
/* -------------------------------------------------------------------------- */

const jadwalSelect = `select j.*, mk.kode_mk, mk.nama_mk, mk.sks, mk.prodi_id as mk_prodi_id,
                             d.nama as dosen_nama, r.nama_ruangan
                        from jadwal_kelas j
                        join mata_kuliah mk on mk.mk_id = j.mk_id
                        left join dosen d on d.dosen_id = j.dosen_id
                        left join ruangan r on r.ruangan_id = j.ruangan_id`;

function mapJadwal(row: Record<string, any>): Record<string, any> {
  const { kode_mk, nama_mk, sks, mk_prodi_id, dosen_nama, nama_ruangan, ...rest } = row;
  return {
    ...rest,
    mata_kuliah: { kode_mk, nama_mk, sks, prodi_id: mk_prodi_id },
    dosen: dosen_nama ? { nama: dosen_nama } : null,
    ruangan: nama_ruangan ? { nama_ruangan } : null,
  };
}

function deriveJadwalStatus(dosenId: unknown, ruanganId: unknown): string {
  if (!dosenId) return "unassigned";
  if (!ruanganId) return "room-missing";
  return "assigned";
}

app.post("/crud-jadwal", async (c) => {
  const user = await requireAdmin(c);
  const data = parse(jadwalActionSchema, await readBody(c));

  if (data.action === "list") {
    const where: string[] = [];
    const params: unknown[] = [];
    if (data.semester) {
      params.push(data.semester);
      where.push(`j.semester = $${params.length}`);
    }
    if (data.tahun_akademik) {
      params.push(data.tahun_akademik);
      where.push(`j.tahun_akademik = $${params.length}`);
    }
    if (data.hari) {
      params.push(data.hari);
      where.push(`j.hari = $${params.length}::hari_enum`);
    }
    if (data.prodi_id !== undefined) {
      params.push(data.prodi_id);
      where.push(`mk.prodi_id = $${params.length}`);
    }
    if (data.dosen_id) {
      params.push(data.dosen_id);
      where.push(`j.dosen_id = $${params.length}`);
    }
    if (data.ruangan_id) {
      params.push(data.ruangan_id);
      where.push(`j.ruangan_id = $${params.length}`);
    }
    if (data.status) {
      params.push(data.status);
      where.push(`j.status = $${params.length}::status_jadwal_enum`);
    }
    const whereSql = where.length ? `where ${where.join(" and ")}` : "";

    const countRow = await one<{ total: number }>(
      `select count(*)::int as total
         from jadwal_kelas j
         join mata_kuliah mk on mk.mk_id = j.mk_id
         ${whereSql}`,
      params,
    );
    const total = countRow?.total ?? 0;
    const { pagination, offset } = paginate(data.page, data.limit, total);

    const rows = await many<Record<string, any>>(
      `${jadwalSelect}
       ${whereSql}
       order by j.created_at desc
       limit $${params.length + 1} offset $${params.length + 2}`,
      [...params, data.limit, offset],
    );

    return ok(c, { jadwal: rows.map(mapJadwal), pagination });
  }

  if (data.action === "get") {
    const row = await one<Record<string, any>>(`${jadwalSelect} where j.jadwal_id = $1`, [data.jadwal_id]);
    if (!row) throw notFound("Jadwal not found");
    return ok(c, mapJadwal(row));
  }

  if (data.action === "create") {
    const status = deriveJadwalStatus(data.dosen_id, data.ruangan_id);
    const result = await run(
      `insert into jadwal_kelas
         (mk_id, dosen_id, ruangan_id, hari, waktu_mulai, waktu_selesai,
          semester, tahun_akademik, status, quota)
       values ($1, $2, $3, $4::hari_enum, $5::time, $6::time, $7, $8, $9::status_jadwal_enum, $10)
       returning *`,
      [
        data.mk_id,
        data.dosen_id ?? null,
        data.ruangan_id ?? null,
        data.hari,
        data.waktu_mulai,
        data.waktu_selesai,
        data.semester,
        data.tahun_akademik,
        status,
        data.quota ?? 0,
      ],
    );
    const row = result.rows[0] as Record<string, any>;
    await logAudit(
      c,
      user,
      "Schedule Plotting",
      `Created jadwal ${row.jadwal_id} - ${data.hari} ${data.waktu_mulai}-${data.waktu_selesai}`,
    );
    return ok(c, row, 201);
  }

  if (data.action === "update") {
    const { action: _action, jadwal_id, ...rawFields } = data;
    const fields = compact(rawFields);
    const existing = await one<{ jadwal_id: string; dosen_id: string | null; ruangan_id: string | null }>(
      `select jadwal_id, dosen_id, ruangan_id from jadwal_kelas where jadwal_id = $1`,
      [jadwal_id],
    );
    if (!existing) throw notFound("Jadwal not found");

    const resolvedDosen = fields.dosen_id !== undefined ? fields.dosen_id : existing.dosen_id;
    const resolvedRuangan = fields.ruangan_id !== undefined ? fields.ruangan_id : existing.ruangan_id;
    const status = deriveJadwalStatus(resolvedDosen, resolvedRuangan);

    const { sets, params } = buildUpdate(fields, [
      "mk_id",
      "dosen_id",
      "ruangan_id",
      "hari",
      "waktu_mulai",
      "waktu_selesai",
      "semester",
      "tahun_akademik",
      "quota",
      "is_active",
    ]);
    params.push(status);
    sets.push(`status = $${params.length}::status_jadwal_enum`);
    params.push(jadwal_id);

    const result = await run(
      `update jadwal_kelas set ${sets.join(", ")} where jadwal_id = $${params.length} returning *`,
      params,
    );
    const row = result.rows[0] as Record<string, any>;
    await logAudit(c, user, "Schedule Plotting", `Updated jadwal ${row.jadwal_id}`);
    return ok(c, row);
  }

  if (data.action === "delete") {
    const existing = await one<{ jadwal_id: string }>(
      `select jadwal_id from jadwal_kelas where jadwal_id = $1`,
      [data.jadwal_id],
    );
    if (!existing) throw notFound("Jadwal not found");

    await run(`update jadwal_kelas set is_active = false where jadwal_id = $1`, [data.jadwal_id]);
    await logAudit(c, user, "Schedule Plotting", `Deleted (soft) jadwal ${data.jadwal_id}`);
    return ok(c, { message: "Jadwal deactivated successfully" });
  }

  if (data.action === "list-enrolled") {
    const rows = await many<Record<string, any>>(
      `select p.pendaftaran_id, p.mahasiswa_id, p.created_at,
              m.mahasiswa_id as m_mahasiswa_id, m.nim, m.nama
         from pendaftaran_kelas p
         join mahasiswa m on m.mahasiswa_id = p.mahasiswa_id
        where p.jadwal_id = $1
        order by p.created_at desc`,
      [data.jadwal_id],
    );
    return ok(c, {
      enrolled: rows.map((row) => {
        const { m_mahasiswa_id, nim, nama, ...rest } = row;
        return { ...rest, mahasiswa: { mahasiswa_id: m_mahasiswa_id, nim, nama } };
      }),
    });
  }

  // toggle-enroll
  const existing = await one<{ pendaftaran_id: string }>(
    `select pendaftaran_id from pendaftaran_kelas where jadwal_id = $1 and mahasiswa_id = $2`,
    [data.jadwal_id, data.mahasiswa_id],
  );

  if (existing) {
    await run(`delete from pendaftaran_kelas where pendaftaran_id = $1`, [existing.pendaftaran_id]);
    await logAudit(
      c,
      user,
      "Schedule Plotting",
      `Unenrolled mahasiswa ${data.mahasiswa_id} from jadwal ${data.jadwal_id}`,
    );
    return ok(c, { enrolled: false });
  }

  await run(`insert into pendaftaran_kelas (jadwal_id, mahasiswa_id) values ($1, $2)`, [
    data.jadwal_id,
    data.mahasiswa_id,
  ]);
  await logAudit(
    c,
    user,
    "Schedule Plotting",
    `Enrolled mahasiswa ${data.mahasiswa_id} to jadwal ${data.jadwal_id}`,
  );
  return ok(c, { enrolled: true }, 201);
});

/* -------------------------------------------------------------------------- */
/* CRUD: ruangan                                                              */
/* -------------------------------------------------------------------------- */

app.post("/crud-ruangan", async (c) => {
  const user = await requireAdmin(c);
  const data = parse(ruanganActionSchema, await readBody(c));

  if (data.action === "list") {
    const where: string[] = [];
    const params: unknown[] = [];
    if (data.search) {
      params.push(`%${data.search}%`);
      where.push(`(r.kode_ruangan ilike $${params.length} or r.nama_ruangan ilike $${params.length})`);
    }
    if (data.is_active !== undefined) {
      params.push(data.is_active);
      where.push(`r.is_active = $${params.length}`);
    }
    if (data.kapasitas_min !== undefined) {
      params.push(data.kapasitas_min);
      where.push(`r.kapasitas >= $${params.length}`);
    }
    if (data.kapasitas_max !== undefined) {
      params.push(data.kapasitas_max);
      where.push(`r.kapasitas <= $${params.length}`);
    }
    const whereSql = where.length ? `where ${where.join(" and ")}` : "";

    const countRow = await one<{ total: number }>(
      `select count(*)::int as total from ruangan r ${whereSql}`,
      params,
    );
    const total = countRow?.total ?? 0;
    const offset = (data.page - 1) * data.per_page;

    const rows = await many<Record<string, any>>(
      `select r.* from ruangan r ${whereSql}
        order by r.kode_ruangan asc
        limit $${params.length + 1} offset $${params.length + 2}`,
      [...params, data.per_page, offset],
    );

    return ok(c, {
      data: rows.map(mapRuangan),
      total,
      page: data.page,
      per_page: data.per_page,
    });
  }

  if (data.action === "get") {
    const row = await one<Record<string, any>>(`select * from ruangan where ruangan_id = $1`, [
      data.ruangan_id,
    ]);
    if (!row) throw notFound("Ruangan not found");
    return ok(c, { data: mapRuangan(row) });
  }

  if (data.action === "create") {
    try {
      const result = await run(
        `insert into ruangan
           (kode_ruangan, nama_ruangan, kapasitas, latitude, longitude, geofence_radius_m)
         values ($1, $2, $3, $4, $5, $6) returning *`,
        [
          data.kode_ruangan,
          data.nama_ruangan,
          data.kapasitas ?? null,
          data.latitude ?? null,
          data.longitude ?? null,
          data.geofence_radius_m,
        ],
      );
      const row = result.rows[0] as Record<string, any>;
      await logAudit(c, user, "Master Data", `Create ruangan: ${row.kode_ruangan} - ${row.nama_ruangan}`);
      return ok(c, { data: mapRuangan(row) }, 201);
    } catch (error) {
      if (isUniqueViolation(error)) throw conflict("Kode ruangan already exists");
      throw error;
    }
  }

  if (data.action === "update") {
    const { action: _action, ruangan_id, ...rawFields } = data;
    const fields = compact(rawFields);
    const { sets, params } = buildUpdate(fields, [
      "kode_ruangan",
      "nama_ruangan",
      "kapasitas",
      "latitude",
      "longitude",
      "geofence_radius_m",
    ]);
    if (sets.length === 0) throw badRequest("No fields to update");

    const existing = await one<{ kode_ruangan: string; nama_ruangan: string }>(
      `select kode_ruangan, nama_ruangan from ruangan where ruangan_id = $1`,
      [ruangan_id],
    );
    if (!existing) throw notFound("Ruangan not found");

    params.push(ruangan_id);
    try {
      const result = await run(
        `update ruangan set ${sets.join(", ")} where ruangan_id = $${params.length} returning *`,
        params,
      );
      const row = result.rows[0] as Record<string, any>;
      await logAudit(c, user, "Master Data", `Update ruangan: ${existing.kode_ruangan} (${ruangan_id})`);
      return ok(c, { data: mapRuangan(row) });
    } catch (error) {
      if (isUniqueViolation(error)) throw conflict("Kode ruangan already exists");
      throw error;
    }
  }

  // delete (soft)
  const existing = await one<{ kode_ruangan: string; nama_ruangan: string }>(
    `select kode_ruangan, nama_ruangan from ruangan where ruangan_id = $1`,
    [data.ruangan_id],
  );
  if (!existing) throw notFound("Ruangan not found");

  await run(`update ruangan set is_active = false where ruangan_id = $1`, [data.ruangan_id]);
  await logAudit(
    c,
    user,
    "Master Data",
    `Soft-delete ruangan: ${existing.kode_ruangan} - ${existing.nama_ruangan} (${data.ruangan_id})`,
  );
  return ok(c, { message: "Ruangan deactivated successfully" });
});

/* -------------------------------------------------------------------------- */
/* CRUD: prodi                                                                */
/* -------------------------------------------------------------------------- */

app.post("/crud-prodi", async (c) => {
  const user = await requireAdmin(c);
  const data = parse(prodiActionSchema, await readBody(c));

  if (data.action === "list") {
    const params: unknown[] = [];
    let whereSql = "";
    if (data.search?.trim()) {
      params.push(`%${data.search.trim()}%`);
      whereSql = `where (kode_prodi ilike $1 or nama_prodi ilike $1)`;
    }
    const rows = await many<Record<string, any>>(
      `select * from program_studi ${whereSql} order by nama_prodi asc`,
      params,
    );
    return ok(c, { data: rows });
  }

  if (data.action === "get") {
    const row = await one<Record<string, any>>(`select * from program_studi where prodi_id = $1`, [
      data.prodi_id,
    ]);
    if (!row) throw notFound("Program studi not found");
    return ok(c, { data: row });
  }

  if (data.action === "create") {
    try {
      const result = await run(
        `insert into program_studi (kode_prodi, nama_prodi) values ($1, $2) returning *`,
        [data.kode_prodi, data.nama_prodi],
      );
      const row = result.rows[0] as Record<string, any>;
      await logAudit(
        c,
        user,
        "Master Data",
        `Created program studi: ${data.kode_prodi} - ${data.nama_prodi}`,
      );
      return ok(c, { message: "Program studi created", data: row }, 201);
    } catch (error) {
      if (isUniqueViolation(error)) throw conflict("Kode prodi already exists");
      throw error;
    }
  }

  if (data.action === "update") {
    const { action: _action, prodi_id, ...rawFields } = data;
    const fields = compact(rawFields);
    const { sets, params } = buildUpdate(fields, ["kode_prodi", "nama_prodi"]);
    if (sets.length === 0) throw badRequest("No fields to update");

    params.push(prodi_id);
    try {
      const result = await run(
        `update program_studi set ${sets.join(", ")} where prodi_id = $${params.length} returning *`,
        params,
      );
      const row = result.rows[0] as Record<string, any> | undefined;
      if (!row) throw notFound("Program studi not found");
      await logAudit(c, user, "Master Data", `Updated program studi (ID: ${prodi_id})`);
      return ok(c, { message: "Program studi updated", data: row });
    } catch (error) {
      if (isUniqueViolation(error)) throw conflict("Kode prodi already exists");
      throw error;
    }
  }

  // delete (hard, blocked by dependents)
  const { prodi_id } = data;
  const dependents = await one<{
    mahasiswa: number;
    dosen: number;
    mata_kuliah: number;
  }>(
    `select
       (select count(*)::int from mahasiswa where prodi_id = $1) as mahasiswa,
       (select count(*)::int from dosen where prodi_id = $1) as dosen,
       (select count(*)::int from mata_kuliah where prodi_id = $1) as mata_kuliah`,
    [prodi_id],
  );

  const parts: string[] = [];
  if (dependents?.mahasiswa) parts.push(`${dependents.mahasiswa} mahasiswa`);
  if (dependents?.dosen) parts.push(`${dependents.dosen} dosen`);
  if (dependents?.mata_kuliah) parts.push(`${dependents.mata_kuliah} mata kuliah`);
  if (parts.length > 0) {
    throw conflict(`Cannot delete: program studi still has ${parts.join(", ")}`);
  }

  const existing = await one<{ prodi_id: number }>(`select prodi_id from program_studi where prodi_id = $1`, [
    prodi_id,
  ]);
  if (!existing) throw notFound("Program studi not found");

  await run(`delete from program_studi where prodi_id = $1`, [prodi_id]);
  await logAudit(c, user, "Master Data", `Deleted program studi (ID: ${prodi_id})`);
  return ok(c, { message: "Program studi deleted" });
});

export default app;
