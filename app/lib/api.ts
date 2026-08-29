import { supabase } from "./supabase";
import { FunctionsHttpError } from "@supabase/supabase-js";

// ─── Profile Cache ─────────────────────────────────────
let profileCache: { data: any; expiry: number } | null = null;
const PROFILE_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export function clearProfileCache() {
  profileCache = null;
}

import type {
  LoginRequest, LoginResponse,
  CheckInResponse,
  OpenSessionRequest, OpenSessionResponse,
  LiveSessionData,
  CourseStudent,
  DosenReportData,
  GlobalAttendanceSession,
  AttendanceStats,
  DosenDashboardData,
  AdminDashboardData,
  AttendanceLog,
  Pagination,
  Mahasiswa,
  Dosen,
  MataKuliah,
  Jadwal,
  Ruangan,
  Prodi,
  AuditLog,
  Notifikasi,
  QrTokenBatch,
  ListSessionsResponse,
  ReopenSessionRequest, ReopenSessionResponse,
  UpdateSessionRequest,
  DosenProfile,
  UpdateDosenProfileRequest,
  ProfileResponse,
} from "./types";

async function invoke<T>(fn: string, body?: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, {
    body: body ?? undefined,
  });
  if (error) {
    let customError: string | null = null;
    if (error instanceof FunctionsHttpError) {
      try {
        const bodyResponse = await error.context.json();
        if (bodyResponse) {
          if (typeof bodyResponse.error === "string") {
            customError = bodyResponse.error;
          } else if (typeof bodyResponse.message === "string") {
            customError = bodyResponse.message;
          }
        }
      } catch { /* ignore */ }
    }
    if (customError) {
      throw new Error(customError);
    }
    throw new Error(error.message);
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export const api = {
  // ─── Auth ───────────────────────────────────────────
  login(req: LoginRequest) {
    return invoke<LoginResponse>("login", req);
  },
  changePassword(current_password: string, new_password: string) {
    return invoke<{ message: string }>("change-password", { current_password, new_password });
  },
  refreshSession(refresh_token: string) {
    return invoke<LoginResponse>("refresh-session", { refresh_token });
  },

  // ─── Mahasiswa ──────────────────────────────────────
  async getMyProfile() {
    const now = Date.now();
    if (profileCache && now < profileCache.expiry) {
      return profileCache.data as ProfileResponse;
    }
    const data = await invoke<ProfileResponse>("get-my-profile");
    profileCache = { data, expiry: now + PROFILE_CACHE_TTL };
    return data;
  },
  getMyDashboard() {
    return invoke<{ date: string; day: string; classes: Array<{
      jadwal_id: string;
      mata_kuliah: { kode_mk: string; nama_mk: string; sks: number };
      waktu_mulai: string; waktu_selesai: string;
      ruangan: string | null;
      sesi_id: string | null; sesi_status: string | null;
    }> }>("get-my-dashboard");
  },
  getMyLogs(params?: { page?: number; limit?: number; semester?: string; tahun_akademik?: string }) {
    return invoke<{ logs: AttendanceLog[]; pagination: Pagination }>("get-my-logs", params ?? {});
  },
  getAttendanceStats(params?: { semester?: string; tahun_akademik?: string }) {
    return invoke<AttendanceStats>("get-attendance-stats", params ?? {});
  },

  // ─── Check-in ───────────────────────────────────────
  checkIn(qr_token: string, latitude: number, longitude: number) {
    return invoke<CheckInResponse>("check-in", { qr_token, latitude, longitude });
  },

  // ─── QR Token ───────────────────────────────────────
  async generateQrToken(sesi_id: string) {
    const res: any = await invoke("generate-qr-token", { sesi_id, ttl_seconds: 15, covers: 1 });
    if (res.tokens) return { qr_token: res.tokens[0]?.qr_token ?? "", expired_at: res.tokens[0]?.expired_at ?? "", ttl_seconds: res.ttl_seconds };
    return { qr_token: res.qr_token, expired_at: res.expired_at, ttl_seconds: res.ttl_seconds };
  },
  async generateQrTokens(sesi_id: string, ttl_seconds: number, covers = 2) {
    const res: any = await invoke("generate-qr-token", { sesi_id, ttl_seconds, covers });
    if (res.tokens) return res as QrTokenBatch;
    return { tokens: [{ qr_token: res.qr_token, expired_at: res.expired_at }], ttl_seconds: res.ttl_seconds ?? ttl_seconds };
  },

  // ─── Dosen: Session ─────────────────────────────────
  openSession(req: OpenSessionRequest) {
    return invoke<OpenSessionResponse>("open-session", req);
  },
  closeSession(sesi_id: string) {
    return invoke<{ message: string }>("close-session", { sesi_id });
  },
  getLiveSession(sesi_id: string) {
    return invoke<LiveSessionData>("get-live-session", { sesi_id });
  },
  updateSessionSettings(sesi_id: string, settings: { geofence_radius_m?: number; qr_rotates_every?: number }) {
    return invoke<{ message: string }>("update-session-settings", { sesi_id, ...settings });
  },
  listSessions(jadwal_id: string, page?: number, limit?: number) {
    return invoke<ListSessionsResponse>("list-sessions", { jadwal_id, page, limit });
  },
  deleteSession(sesi_id: string) {
    return invoke<{ message: string }>("delete-session", { sesi_id });
  },
  reopenSession(req: ReopenSessionRequest) {
    return invoke<ReopenSessionResponse>("reopen-session", req);
  },
  updateSession(req: UpdateSessionRequest) {
    return invoke<{ message: string }>("update-session", req);
  },

  // ─── Dosen: Attendance ──────────────────────────────
  correctAttendance(presensi_id: string, status_baru: string, alasan?: string) {
    return invoke<{ message: string }>("correct-attendance", { presensi_id, status_baru, alasan });
  },
  bulkMarkPresent(sesi_id: string, mahasiswa_ids: string[], status: string) {
    return invoke<{ message: string; updated: number; inserted: number }>("bulk-mark-present", { sesi_id, mahasiswa_ids, status });
  },

  // ─── Dosen: Dashboard ───────────────────────────────
  getDosenDashboard() {
    return invoke<DosenDashboardData>("get-dosen-dashboard");
  },
  getDosenProfile() {
    return invoke<DosenProfile>("get-dosen-profile");
  },
  updateDosenProfile(req: UpdateDosenProfileRequest) {
    return invoke<{ message: string }>("update-dosen-profile", req);
  },
  getCourseStudents(params: { jadwal_id: string; page?: number; limit?: number; search?: string; sesi_id?: string }) {
    return invoke<{ students: CourseStudent[]; pagination: Pagination }>("get-course-students", params);
  },
  getDosenReport(jadwal_id: string) {
    return invoke<DosenReportData>("get-dosen-report", { jadwal_id });
  },
  async exportReport(jadwal_id: string, format: "csv" | "json" = "csv"): Promise<string> {
    const { data, error } = await supabase.functions.invoke("export-report", {
      body: { jadwal_id, format },
    });
    if (error) {
      let customError: string | null = null;
      if (error instanceof FunctionsHttpError) {
        try {
          const bodyResponse = await error.context.json();
          if (bodyResponse) {
            if (typeof bodyResponse.error === "string") {
              customError = bodyResponse.error;
            } else if (typeof bodyResponse.message === "string") {
              customError = bodyResponse.message;
            }
          }
        } catch { /* ignore */ }
      }
      if (customError) {
        throw new Error(customError);
      }
      throw new Error(error.message);
    }
    if (typeof data === "string") return data;
    if (data?.error) throw new Error(data.error);
    return data as string;
  },

  // ─── Admin: CRUD Mahasiswa ──────────────────────────
  crudMahasiswa(action: string, payload?: Record<string, unknown>) {
    return invoke<any>("crud-mahasiswa", { action, ...payload });
  },

  // ─── Admin: CRUD Dosen ──────────────────────────────
  crudDosen(action: string, payload?: Record<string, unknown>) {
    return invoke<any>("crud-dosen", { action, ...payload });
  },

  // ─── Admin: CRUD Mata Kuliah ────────────────────────
  crudMataKuliah(action: string, payload?: Record<string, unknown>) {
    return invoke<any>("crud-mata-kuliah", { action, ...payload });
  },

  // ─── Admin: CRUD Jadwal ─────────────────────────────
  crudJadwal(action: string, payload?: Record<string, unknown>) {
    return invoke<any>("crud-jadwal", { action, ...payload });
  },

  // ─── Admin: CRUD Ruangan ────────────────────────────
  crudRuangan(action: string, payload?: Record<string, unknown>) {
    return invoke<any>("crud-ruangan", { action, ...payload });
  },

  // ─── Admin: CRUD Prodi ──────────────────────────────
  crudProdi(action: string, payload?: Record<string, unknown>) {
    return invoke<any>("crud-prodi", { action, ...payload });
  },

  // ─── Admin: Dashboard ───────────────────────────────
  getAdminDashboard() {
    return invoke<AdminDashboardData>("get-admin-dashboard");
  },

  // ─── Admin: Global Attendance ───────────────────────
  getGlobalAttendance(params?: { status?: string; tanggal?: string; jadwal_id?: string; page?: number; limit?: number }) {
    return invoke<{ sessions: GlobalAttendanceSession[]; pagination: Pagination }>("get-global-attendance", params ?? {});
  },

  // ─── Admin: Attendance Courses ─────────────────────
  getAdminAttendanceCourses() {
    return invoke<{ courses: Array<{
      jadwal_id: string;
      mata_kuliah: { mk_id: string; kode_mk: string; nama_mk: string; sks: number };
      dosen: { dosen_id: string; nama: string };
      hari: string | null;
      waktu_mulai: string;
      waktu_selesai: string;
      semester: string;
      ruangan: string | null;
      enrolled: number;
      latest_session: { sesi_id: string; status: string; tanggal: string } | null;
    }> }>("get-admin-attendance-courses");
  },

  // ─── Admin: Audit Logs ──────────────────────────────
  getAuditLogs(params?: {
    page?: number; limit?: number; kategori?: string; status?: string;
    search?: string; from_date?: string; to_date?: string; user_id?: string; format?: "json" | "csv";
  }) {
    return invoke<{ logs: AuditLog[]; pagination: Pagination }>("get-audit-logs", params ?? {});
  },

  // ─── Admin: Notifications ───────────────────────────
  getNotifications(action: "list" | "mark-read" | "mark-all-read" | "stats", payload?: Record<string, unknown>) {
    return invoke<any>("get-notifications", { action, ...payload });
  },

  // ─── Provision User ─────────────────────────────────
  provisionUser(params: { email: string; password: string; name: string; role: "mahasiswa" | "dosen"; identifier: string; prodi_id: number }) {
    return invoke<{ message: string; user_id: string; role: string; identifier: string }>("provision-user", params);
  },
};
