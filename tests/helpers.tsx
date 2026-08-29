import { render, type RenderOptions } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";
import { ToastProvider } from "../app/components/Toast";
import { vi } from "vitest";

export function renderWithRouter(
  ui: React.ReactElement,
  options?: RenderOptions & { initialEntries?: string[] }
) {
  const { initialEntries, ...renderOptions } = options || {};
  return render(
    <MemoryRouter initialEntries={initialEntries || ["/"]}>
      <ToastProvider>
        <Routes>
          <Route path="/dosen/attendance/correction/:jadwal_id" element={ui} />
          <Route path="/dosen/attendance/:jadwal_id/sessions" element={ui} />
          <Route path="/dosen/attendance/:jadwal_id" element={ui} />
          <Route path="/dosen" element={ui} />
          <Route path="/dosen/*" element={ui} />
          <Route path="/" element={ui} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
    renderOptions
  );
}

export const mockCourses = [
  {
    jadwal_id: "jadwal-001",
    mata_kuliah: { kode_mk: "CS302", nama_mk: "Algorithms", sks: 3 },
    hari: "Monday",
    waktu_mulai: "08:00",
    waktu_selesai: "10:00",
    semester: "Ganjil",
    ruangan: "Ruang 101",
    enrolled: 40,
    latest_session: {
      sesi_id: "sesi-001",
      status: "live",
      tanggal: "2026-06-26",
    },
  },
  {
    jadwal_id: "jadwal-002",
    mata_kuliah: { kode_mk: "CS101", nama_mk: "Intro to CS", sks: 2 },
    hari: "Tuesday",
    waktu_mulai: "10:00",
    waktu_selesai: "12:00",
    semester: "Ganjil",
    ruangan: "Ruang 202",
    enrolled: 35,
    latest_session: {
      sesi_id: "sesi-002",
      status: "closed",
      tanggal: "2026-06-25",
    },
  },
  {
    jadwal_id: "jadwal-003",
    mata_kuliah: { kode_mk: "DS205", nama_mk: "Data Science", sks: 3 },
    hari: "Wednesday",
    waktu_mulai: "13:00",
    waktu_selesai: "15:00",
    semester: "Ganjil",
    ruangan: null,
    enrolled: 0,
    latest_session: null,
  },
];

export const mockLiveSession = {
  sesi_id: "sesi-001",
  status: "live",
  waktu_mulai: new Date(Date.now() - 1800000).toISOString(),
  geofence_radius_m: 50,
  qr_rotates_every: 15,
  counts: { present: 10, absent: 30 },
  recent_checkins: [],
};

export const mockQrTokenBatch = {
  tokens: [
    { qr_token: "token-1", expired_at: new Date(Date.now() + 15000).toISOString() },
    { qr_token: "token-2", expired_at: new Date(Date.now() + 30000).toISOString() },
    { qr_token: "token-3", expired_at: new Date(Date.now() + 45000).toISOString() },
    { qr_token: "token-4", expired_at: new Date(Date.now() + 60000).toISOString() },
  ],
  ttl_seconds: 15,
};

export const mockCourseStudents = {
  students: [
    {
      mahasiswa_id: "mhs-001",
      nim: "1234567890",
      nama: "Budi Santoso",
      gpa: 3.5,
      attendance: { presensi_id: "pres-001", status: "present", waktu_check_in: new Date().toISOString(), geofence_flagged: false },
    },
    {
      mahasiswa_id: "mhs-002",
      nim: "1234567891",
      nama: "Siti Rahayu",
      gpa: 3.8,
      attendance: { presensi_id: "pres-002", status: "absent", waktu_check_in: "", geofence_flagged: false },
    },
  ],
  pagination: { page: 1, limit: 100, total: 2, total_pages: 1 },
};

export function mockApi() {
  const api = {
    getDosenDashboard: vi.fn().mockResolvedValue({ dosen: { nama: "Dr. Test" }, courses: mockCourses }),
    getLiveSession: vi.fn().mockResolvedValue(mockLiveSession),
    generateQrTokens: vi.fn().mockResolvedValue(mockQrTokenBatch),
    generateQrToken: vi.fn().mockResolvedValue({ qr_token: "token-1", expired_at: new Date().toISOString(), ttl_seconds: 15 }),
    openSession: vi.fn().mockResolvedValue({ sesi_id: "sesi-new", status: "live", qr_seed: 123 }),
    closeSession: vi.fn().mockResolvedValue({ message: "Session closed" }),
    updateSessionSettings: vi.fn().mockResolvedValue({ message: "Settings updated" }),
    getCourseStudents: vi.fn().mockResolvedValue(mockCourseStudents),
    correctAttendance: vi.fn().mockResolvedValue({ message: "Corrected" }),
    listSessions: vi.fn().mockResolvedValue({
      sessions: [
        {
          sesi_id: "sesi-001",
          jadwal_id: "jadwal-001",
          tanggal: "2026-06-26",
          waktu_mulai: "2026-06-26T08:00:00",
          waktu_selesai: "2026-06-26T09:00:00",
          status: "completed",
          geofence_radius_m: 50,
          qr_rotates_every: 15,
          present_count: 10,
          absent_count: 5,
          total_count: 15,
        },
        {
          sesi_id: "sesi-002",
          jadwal_id: "jadwal-001",
          tanggal: "2026-06-20",
          waktu_mulai: "2026-06-20T08:00:00",
          waktu_selesai: "2026-06-20T09:00:00",
          status: "completed",
          geofence_radius_m: 50,
          qr_rotates_every: 15,
          present_count: 12,
          absent_count: 3,
          total_count: 15,
        },
      ],
      pagination: { page: 1, limit: 10, total: 2, total_pages: 1 },
    }),
    deleteSession: vi.fn().mockResolvedValue({ message: "Session deleted" }),
    reopenSession: vi.fn().mockResolvedValue({ sesi_id: "sesi-001", status: "live" }),
    updateSession: vi.fn().mockResolvedValue({ message: "Session updated" }),
  };
  return api;
}
