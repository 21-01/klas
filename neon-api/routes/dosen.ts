import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import { uuid } from "../lib/ids.ts";
import { many, one, transaction } from "../lib/db.ts";
import { badRequest, forbidden, notFound, ok, text } from "../lib/http.ts";
import {
  currentUser,
  requireRole,
  assertJadwalAccess,
  getClientIp,
} from "../lib/auth.ts";
import { audit } from "../lib/audit.ts";
import { paginate, rate } from "../lib/util.ts";
import { putObject } from "../lib/storage.ts";

const app = new Hono();

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

const dosenOrAdmin = ["admin", "super_admin", "admin_prodi", "dosen"] as const;

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

app.post("/get-dosen-dashboard", async (c) => {
  const user = await currentUser(c);
  if (!user.dosenId) throw forbidden("Dosen profile not found");

  const dosen = await one<{ nama: string }>(`select nama from dosen where dosen_id = $1`, [
    user.dosenId,
  ]);
  if (!dosen) throw forbidden("Dosen profile not found");

  const courses = await many<{
    jadwal_id: string;
    hari: string;
    waktu_mulai: string;
    waktu_selesai: string;
    semester: string;
    kode_mk: string;
    nama_mk: string;
    sks: number;
    nama_ruangan: string | null;
    enrolled: number;
    sesi_id: string | null;
    status: string | null;
    tanggal: string | null;
  }>(
    `select j.jadwal_id, j.hari, j.waktu_mulai, j.waktu_selesai, j.semester,
            mk.kode_mk, mk.nama_mk, mk.sks, r.nama_ruangan,
            ls.sesi_id, ls.status, ls.tanggal::text as tanggal,
            (select count(*)::int from pendaftaran_kelas p where p.jadwal_id = j.jadwal_id) as enrolled
       from jadwal_kelas j
       join mata_kuliah mk on mk.mk_id = j.mk_id
       left join ruangan r on r.ruangan_id = j.ruangan_id
       left join lateral (
         select s.sesi_id, s.status, s.tanggal
           from sesi_kehadiran s
          where s.jadwal_id = j.jadwal_id
          order by s.waktu_mulai desc
          limit 1
       ) ls on true
      where j.dosen_id = $1
      order by j.hari, j.waktu_mulai`,
    [user.dosenId],
  );

  return ok(c, {
    dosen: { nama: dosen.nama },
    courses: courses.map((course) => ({
      jadwal_id: course.jadwal_id,
      mata_kuliah: {
        kode_mk: course.kode_mk,
        nama_mk: course.nama_mk,
        sks: course.sks,
      },
      hari: course.hari,
      waktu_mulai: course.waktu_mulai,
      waktu_selesai: course.waktu_selesai,
      semester: course.semester,
      ruangan: course.nama_ruangan ?? null,
      enrolled: course.enrolled,
      latest_session: course.sesi_id
        ? { sesi_id: course.sesi_id, status: course.status, tanggal: course.tanggal }
        : null,
    })),
  });
});

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

app.post("/get-dosen-profile", async (c) => {
  const user = await currentUser(c);

  const dsn = await one<{
    dosen_id: string;
    nip: string | null;
    nidn: string | null;
    nama: string;
    jenis_kelamin: string | null;
    kode_prodi: string;
    nama_prodi: string;
  }>(
    `select d.dosen_id, d.nip, d.nidn, d.nama, d.jenis_kelamin,
            p.kode_prodi, p.nama_prodi
       from dosen d
       join program_studi p on p.prodi_id = d.prodi_id
      where d.user_id = $1`,
    [user.userId],
  );
  if (!dsn) throw notFound("Dosen profile not found");

  return ok(c, {
    dosen_id: dsn.dosen_id,
    nip: dsn.nip,
    nidn: dsn.nidn,
    nama: dsn.nama,
    jenis_kelamin: dsn.jenis_kelamin,
    prodi: { kode_prodi: dsn.kode_prodi, nama_prodi: dsn.nama_prodi },
    email: user.email,
  });
});

const updateProfileSchema = z.object({
  nama: z.string().min(1, "Name is required").optional(),
  jenis_kelamin: z.enum(["L", "P"]).optional(),
});

app.post("/update-dosen-profile", async (c) => {
  const user = await currentUser(c);
  const input = parseBody(updateProfileSchema, await readBody(c));

  const sets: string[] = [];
  const params: unknown[] = [];
  if (input.nama !== undefined) {
    params.push(input.nama);
    sets.push(`nama = $${params.length}`);
  }
  if (input.jenis_kelamin !== undefined) {
    params.push(input.jenis_kelamin);
    sets.push(`jenis_kelamin = $${params.length}`);
  }
  if (sets.length === 0) throw badRequest("No fields to update");

  const dsn = await one<{ dosen_id: string }>(
    `select dosen_id from dosen where user_id = $1`,
    [user.userId],
  );
  if (!dsn) throw notFound("Dosen profile not found");

  params.push(dsn.dosen_id);
  await transaction(async (client) => {
    await client.query(
      `update dosen set ${sets.join(", ")} where dosen_id = $${params.length}`,
      params,
    );
    if (input.nama !== undefined) {
      await client.query(`update users set name = $1 where user_id = $2`, [
        input.nama,
        user.userId,
      ]);
      await client.query(`update neon_auth."user" set name = $1 where id = $2`, [
        input.nama,
        user.userId,
      ]);
    }
  });

  await audit({
    userId: user.userId,
    kategori: "Master Data",
    aksi: `Dosen profile updated: ${Object.keys(input).join(", ")}`,
    ip: getClientIp(c),
    status: "success",
  });

  return ok(c, { message: "Profile updated successfully" });
});

// ---------------------------------------------------------------------------
// Course roster
// ---------------------------------------------------------------------------

const courseStudentsSchema = z.object({
  jadwal_id: uuid(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().optional(),
  sesi_id: uuid().optional(),
});

app.post("/get-course-students", async (c) => {
  const user = await requireRole(c, [...dosenOrAdmin]);
  const input = parseBody(courseStudentsSchema, await readBody(c));
  const { jadwal_id, page, limit, sesi_id } = input;
  const search = input.search?.trim();

  await assertJadwalAccess(user, jadwal_id);

  const params: unknown[] = [jadwal_id];
  let where = "p.jadwal_id = $1";
  if (search) {
    params.push(`%${search}%`);
    where += ` and (m.nim ilike $${params.length} or m.nama ilike $${params.length})`;
  }

  const totalRow = await one<{ total: number }>(
    `select count(*)::int as total
       from pendaftaran_kelas p
       join mahasiswa m on m.mahasiswa_id = p.mahasiswa_id
      where ${where}`,
    params,
  );
  const total = totalRow?.total ?? 0;
  const { pagination, offset } = paginate(page, limit, total);

  const rows = await many<{
    mahasiswa_id: string;
    nim: string;
    nama: string;
    gpa: number | null;
  }>(
    `select m.mahasiswa_id, m.nim, m.nama, m.gpa
       from pendaftaran_kelas p
       join mahasiswa m on m.mahasiswa_id = p.mahasiswa_id
      where ${where}
      order by m.nama
      limit $${params.length + 1} offset $${params.length + 2}`,
    [...params, limit, offset],
  );

  const attendance = new Map<
    string,
    {
      presensi_id: string;
      status: string;
      waktu_check_in: string | null;
      geofence_flagged: boolean;
    }
  >();

  if (sesi_id && rows.length > 0) {
    const records = await many<{
      presensi_id: string;
      mahasiswa_id: string;
      status: string;
      waktu_check_in: string | null;
      geofence_flagged: boolean;
    }>(
      `select presensi_id, mahasiswa_id, status, waktu_check_in, geofence_flagged
         from presensi
        where sesi_id = $1 and mahasiswa_id = any($2::uuid[])`,
      [sesi_id, rows.map((row) => row.mahasiswa_id)],
    );
    for (const record of records) {
      attendance.set(record.mahasiswa_id, {
        presensi_id: record.presensi_id,
        status: record.status,
        waktu_check_in: record.waktu_check_in,
        geofence_flagged: record.geofence_flagged,
      });
    }
  }

  return ok(c, {
    students: rows.map((row) => ({
      mahasiswa_id: row.mahasiswa_id,
      nim: row.nim,
      nama: row.nama,
      gpa: row.gpa === null ? null : Number(row.gpa),
      attendance: attendance.get(row.mahasiswa_id) ?? null,
    })),
    pagination,
  });
});

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

const reportSchema = z.object({
  jadwal_id: uuid(),
});

interface CourseRow {
  jadwal_id: string;
  hari: string;
  waktu_mulai: string;
  waktu_selesai: string;
  semester: string;
  tahun_akademik: string;
  kode_mk: string;
  nama_mk: string;
  sks: number;
  nama_ruangan: string | null;
}

async function loadCourse(jadwalId: string): Promise<CourseRow> {
  const course = await one<CourseRow>(
    `select j.jadwal_id, j.hari, j.waktu_mulai, j.waktu_selesai, j.semester,
            j.tahun_akademik, mk.kode_mk, mk.nama_mk, mk.sks, r.nama_ruangan
       from jadwal_kelas j
       join mata_kuliah mk on mk.mk_id = j.mk_id
       left join ruangan r on r.ruangan_id = j.ruangan_id
      where j.jadwal_id = $1`,
    [jadwalId],
  );
  if (!course) throw notFound("Schedule not found");
  return course;
}

async function loadSessions(jadwalId: string) {
  return many<{ sesi_id: string; tanggal: string; status: string }>(
    `select sesi_id, tanggal::text as tanggal, status
       from sesi_kehadiran
      where jadwal_id = $1
      order by tanggal asc`,
    [jadwalId],
  );
}

async function loadEnrollments(jadwalId: string) {
  return many<{
    mahasiswa_id: string;
    nim: string;
    nama: string;
    gpa: number | null;
  }>(
    `select m.mahasiswa_id, m.nim, m.nama, m.gpa
       from pendaftaran_kelas p
       join mahasiswa m on m.mahasiswa_id = p.mahasiswa_id
      where p.jadwal_id = $1
      order by m.nama`,
    [jadwalId],
  );
}

async function loadAttendanceByStudent(sessionIds: string[]) {
  const map = new Map<string, Map<string, string>>();
  if (sessionIds.length === 0) return map;

  const rows = await many<{ mahasiswa_id: string; sesi_id: string; status: string }>(
    `select mahasiswa_id, sesi_id, status
       from presensi
      where sesi_id = any($1::uuid[])`,
    [sessionIds],
  );

  for (const row of rows) {
    let bySession = map.get(row.mahasiswa_id);
    if (!bySession) {
      bySession = new Map();
      map.set(row.mahasiswa_id, bySession);
    }
    bySession.set(row.sesi_id, row.status);
  }
  return map;
}

app.post("/get-dosen-report", async (c) => {
  const user = await requireRole(c, [...dosenOrAdmin]);
  const { jadwal_id } = parseBody(reportSchema, await readBody(c));

  await assertJadwalAccess(user, jadwal_id);

  const course = await loadCourse(jadwal_id);
  const sessions = await loadSessions(jadwal_id);
  const enrollments = await loadEnrollments(jadwal_id);
  const sessionIds = sessions.map((session) => session.sesi_id);
  const attendanceByStudent = await loadAttendanceByStudent(sessionIds);

  const counts = new Map<string, { present: number; absent: number; excused: number; total: number }>();
  for (const [mahasiswaId, bySession] of attendanceByStudent) {
    const tally = { present: 0, absent: 0, excused: 0, total: 0 };
    for (const status of bySession.values()) {
      tally.total += 1;
      if (status === "present" || status === "late") tally.present += 1;
      else if (status === "absent") tally.absent += 1;
      else if (status === "excused") tally.excused += 1;
    }
    counts.set(mahasiswaId, tally);
  }

  const totalSessions = sessions.length;
  const students = enrollments.map((enrollment) => {
    const tally = counts.get(enrollment.mahasiswa_id) ?? {
      present: 0,
      absent: 0,
      excused: 0,
      total: 0,
    };
    return {
      nim: enrollment.nim,
      nama: enrollment.nama,
      gpa: enrollment.gpa === null ? null : Number(enrollment.gpa),
      attendance: tally,
      rate: rate(tally.present, totalSessions),
    };
  });

  const totalPresent = students.reduce((sum, student) => sum + student.attendance.present, 0);
  const totalPossible = students.reduce((sum, student) => sum + student.attendance.total, 0);

  return ok(c, {
    course: { kode_mk: course.kode_mk, nama_mk: course.nama_mk, sks: course.sks },
    schedule: {
      hari: course.hari,
      waktu_mulai: course.waktu_mulai,
      waktu_selesai: course.waktu_selesai,
      semester: course.semester,
      tahun_akademik: course.tahun_akademik,
      ruangan: course.nama_ruangan,
    },
    total_sessions: totalSessions,
    total_students: students.length,
    overall_attendance_rate: rate(totalPresent, totalPossible),
    students,
  });
});

const exportSchema = z.object({
  jadwal_id: uuid(),
  format: z.enum(["csv"]).default("csv"),
});

app.post("/export-report", async (c) => {
  const user = await requireRole(c, [...dosenOrAdmin]);
  const { jadwal_id } = parseBody(exportSchema, await readBody(c));

  await assertJadwalAccess(user, jadwal_id);

  const sessions = await loadSessions(jadwal_id);
  const enrollments = await loadEnrollments(jadwal_id);
  const sessionIds = sessions.map((session) => session.sesi_id);
  const attendanceByStudent = await loadAttendanceByStudent(sessionIds);

  let csv = "NIM,Nama,";
  csv += sessions.map((session) => session.tanggal).join(",");
  csv += ",Rate\n";

  for (const enrollment of enrollments) {
    const bySession = attendanceByStudent.get(enrollment.mahasiswa_id);
    const cells = sessions.map((session) => {
      const status = bySession?.get(session.sesi_id);
      if (status === "present" || status === "late") return "P";
      if (status === "excused") return "E";
      if (status === "absent") return "A";
      return "";
    });
    const presentCount = cells.filter((cell) => cell === "P").length;
    const attendanceRate =
      sessionIds.length > 0 ? ((presentCount / sessionIds.length) * 100).toFixed(1) : "0.0";
    csv += [enrollment.nim, enrollment.nama, ...cells, `${attendanceRate}%`].join(",") + "\n";
  }

  const key = `reports/${jadwal_id}-${Date.now()}.csv`;
  try {
    await putObject(key, csv, "text/csv");
    console.log(`[export-report] uploaded ${key}`);
  } catch (error) {
    console.warn(
      "[export-report] object storage upload skipped:",
      error instanceof Error ? error.message : error,
    );
  }

  return text(c, csv, `report-${jadwal_id}.csv`);
});

export default app;
