export type UserRole = "mahasiswa" | "dosen" | "admin" | "super_admin" | "admin_prodi";

export type ProfileResponse =
  | {
      user_id: string;
      email?: string;
      role: "mahasiswa";
      nim: string;
      nama: string;
      angkatan: string;
      jenis_kelamin: string;
      gpa: number;
      pembimbing_akademik: string;
      prodi: { kode_prodi: string; nama_prodi: string };
    }
  | {
      user_id: string;
      email?: string;
      role: "dosen";
      nama: string;
    }
  | {
      user_id: string;
      email?: string;
      role: "admin" | "super_admin" | "admin_prodi";
      name: string;
    };

export interface User {
  user_id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface Mahasiswa {
  mahasiswa_id: string;
  nim: string;
  user_id: string;
  nama: string;
  angkatan: string;
  jenis_kelamin: "L" | "P";
  gpa: number;
  pembimbing_akademik: string;
  is_active: boolean;
  prodi_id: number;
  prodi?: Prodi;
  users?: Pick<User, "email">;
}

export interface Dosen {
  dosen_id: string;
  nip: string;
  nidn?: string;
  user_id: string;
  nama: string;
  jenis_kelamin?: "L" | "P";
  is_active: boolean;
  prodi_id: number;
  program_studi?: Prodi;
  users?: Pick<User, "email">;
}

export interface Prodi {
  prodi_id: number;
  kode_prodi: string;
  nama_prodi: string;
}

export interface DosenProfile {
  dosen_id: string;
  nip: string;
  nidn?: string;
  nama: string;
  jenis_kelamin?: "L" | "P";
  prodi: { kode_prodi: string; nama_prodi: string };
  email: string;
}

export interface UpdateDosenProfileRequest {
  nama?: string;
  jenis_kelamin?: "L" | "P";
}

export interface MataKuliah {
  mk_id: string;
  kode_mk: string;
  nama_mk: string;
  sks: number;
  prodi_id: number;
  is_active: boolean;
  program_studi?: Prodi;
}

export interface Jadwal {
  jadwal_id: string;
  mk_id: string;
  dosen_id?: string | null;
  ruangan_id?: string | null;
  hari: string;
  waktu_mulai: string;
  waktu_selesai: string;
  semester: string;
  tahun_akademik: string;
  status: string;
  quota: number;
  is_active: boolean;
  mata_kuliah?: MataKuliah;
  dosen?: Dosen;
  ruangan?: Ruangan;
}

export interface Ruangan {
  ruangan_id: string;
  kode_ruangan: string;
  nama_ruangan: string;
  kapasitas?: number;
  latitude?: number;
  longitude?: number;
  geofence_radius_m: number;
  is_active: boolean;
}

export interface SesiKehadiran {
  sesi_id: string;
  jadwal_id: string;
  tanggal: string;
  waktu_mulai: string;
  waktu_selesai?: string;
  status: string;
  qr_seed?: number;
  geofence_radius_m: number;
  qr_rotates_every: number;
  dosen_id: string;
  jadwal_kelas?: Jadwal;
}

export interface Presensi {
  presensi_id: string;
  mahasiswa_id: string;
  sesi_id: string;
  waktu_check_in: string;
  status: string;
  metode: string;
  latitude: number;
  longitude: number;
  ip_address: string;
  geofence_flagged: boolean;
  geofence_delta_m: number;
  dosen_corrected: boolean;
  mahasiswa?: Mahasiswa;
  sesi_kehadiran?: SesiKehadiran;
}

export interface AttendanceLog {
  presensi_id: string;
  waktu_check_in: string;
  status: string;
  metode: string;
  latitude: number;
  longitude: number;
  geofence_flagged: boolean;
  geofence_delta_m: number;
  sesi_kehadiran: {
    tanggal: string;
    waktu_mulai: string;
    waktu_selesai: string;
    jadwal_kelas: {
      mata_kuliah: {
        kode_mk: string;
        nama_mk: string;
        sks: number;
      };
    };
  };
}

export interface Notifikasi {
  notifikasi_id: string;
  user_id: string;
  tipe: string;
  judul: string;
  pesan: string;
  is_read: boolean;
  created_at: string;
  user?: Pick<User, "user_id" | "email" | "name" | "role">;
}

export interface AuditLog {
  log_id: number;
  user_id: string;
  timestamp: string;
  kategori: string;
  aksi: string;
  ip_address: string;
  status: string;
  metadata?: any;
  created_at: string;
  users?: { name: string; email: string } | null;
}

export interface DashboardClass {
  jadwal_id: string;
  mata_kuliah: {
    kode_mk: string;
    nama_mk: string;
    sks: number;
  };
  waktu_mulai: string;
  waktu_selesai: string;
  ruangan: string | null;
  sesi_id: string | null;
  sesi_status: string | null;
}

export interface AdminDashboardData {
  total_students: number;
  total_lecturers: number;
  total_courses: number;
  total_rooms: number;
  active_sessions_today: number;
  completed_sessions_today: number;
  total_sessions_all_time: number;
  total_enrollments: number;
  overall_attendance_rate: number;
  students_with_low_attendance: number;
  attendance_trend: Array<{ date: string; present_count: number; absent_count: number }>;
  geofence_violations: number;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface ListResponse<T> {
  data: T[];
  pagination: Pagination;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  session: {
    access_token: string;
    refresh_token: string;
    expires_at?: number;
  };
  user: {
    id: string;
    email?: string;
    name: string;
    role: string;
  };
}

export interface CheckInResponse {
  message: string;
  status: "present" | "late";
  room: string;
  distance: string;
}

export interface OpenSessionRequest {
  jadwal_id: string;
  tanggal?: string;
  geofence_radius_m?: number;
  qr_rotates_every?: number;
}

export interface OpenSessionResponse {
  sesi_id: string;
  status: string;
  qr_seed: number;
}

export interface LiveSessionData {
  sesi_id: string;
  status: string;
  waktu_mulai: string;
  geofence_radius_m?: number;
  qr_rotates_every?: number;
  counts: { present: number; absent: number };
  recent_checkins: Array<{
    presensi_id: string;
    waktu_check_in: string;
    status: string;
    mahasiswa_id: string;
    mahasiswa: { nim: string; nama: string };
  }>;
}

export interface CourseStudent {
  mahasiswa_id: string;
  nim: string;
  nama: string;
  gpa: number;
  attendance: { status: string; waktu_check_in: string; geofence_flagged: boolean } | null;
}

export interface DosenReportData {
  course: { kode_mk: string; nama_mk: string; sks: number };
  schedule: { hari: string; waktu_mulai: string; waktu_selesai: string; semester: string; tahun_akademik: string; ruangan: string };
  total_sessions: number;
  total_students: number;
  overall_attendance_rate: number;
  students: Array<{
    nim: string;
    nama: string;
    gpa: number;
    attendance: { present: number; absent: number; excused: number; total: number };
    rate: number;
  }>;
}

export interface GlobalAttendanceSession {
  sesi_id: string;
  tanggal: string;
  waktu_mulai: string;
  waktu_selesai: string;
  status: string;
  mata_kuliah: { kode_mk: string; nama_mk: string };
  dosen: { nama: string };
  ruangan: { nama_ruangan: string };
  enrolled_count: number;
  attendance_counts: { present: number; absent: number; excused: number; late: number; total: number };
  attendance_rate: number;
}

export interface AttendanceStats {
  total_sessions: number;
  breakdown: { present: number; absent: number; excused: number; late: number };
  attendance_rate: number;
  semester: string | null;
  tahun_akademik: string | null;
}

export interface DosenDashboardData {
  dosen: { nama: string };
  courses: Array<{
    jadwal_id: string;
    mata_kuliah: { kode_mk: string; nama_mk: string; sks: number };
    hari: string;
    waktu_mulai: string;
    waktu_selesai: string;
    semester: string;
    ruangan: string | null;
    enrolled: number;
    latest_session: { sesi_id: string; status: string; tanggal: string } | null;
  }>;
}

export interface QrTokenBatch {
  tokens: Array<{ qr_token: string; expired_at: string }>;
  ttl_seconds: number;
}

export interface SessionHistoryItem {
  sesi_id: string;
  jadwal_id: string;
  tanggal: string;
  waktu_mulai: string;
  waktu_selesai?: string;
  status: string;
  geofence_radius_m: number;
  qr_rotates_every: number;
  present_count: number;
  absent_count: number;
  total_count: number;
}

export interface ListSessionsResponse {
  sessions: SessionHistoryItem[];
  pagination: Pagination;
}

export interface DeleteSessionRequest {
  sesi_id: string;
}

export interface ReopenSessionRequest {
  sesi_id: string;
  tanggal?: string;
  geofence_radius_m?: number;
  qr_rotates_every?: number;
}

export interface ReopenSessionResponse {
  sesi_id: string;
  status: string;
}

export interface UpdateSessionRequest {
  sesi_id: string;
  tanggal?: string;
  geofence_radius_m?: number;
  qr_rotates_every?: number;
}
