import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithRouter } from "../helpers";
import SessionsHistory from "../../app/routes/dosen/sessions";

const mockListSessions = vi.fn();
const mockDeleteSession = vi.fn();
const mockReopenSession = vi.fn();
const mockUpdateSession = vi.fn();
const mockGetDosenDashboard = vi.fn();

vi.mock("../../app/lib/api", () => ({
  api: {
    listSessions: (...args: any[]) => mockListSessions(...args),
    deleteSession: (...args: any[]) => mockDeleteSession(...args),
    reopenSession: (...args: any[]) => mockReopenSession(...args),
    updateSession: (...args: any[]) => mockUpdateSession(...args),
    getDosenDashboard: (...args: any[]) => mockGetDosenDashboard(...args),
  },
}));

vi.mock("../../app/components/Toast", () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockSessions = [
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
];

describe("Sessions History Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListSessions.mockResolvedValue({
      sessions: mockSessions,
      pagination: { page: 1, limit: 10, total: 2, total_pages: 1 },
    });
    mockGetDosenDashboard.mockResolvedValue({
      dosen: { nama: "Dr. Test" },
      courses: [
        {
          jadwal_id: "jadwal-001",
          mata_kuliah: { kode_mk: "CS302", nama_mk: "Algorithms", sks: 3 },
        },
      ],
    });
    mockDeleteSession.mockResolvedValue({ message: "Session deleted" });
    mockReopenSession.mockResolvedValue({ sesi_id: "sesi-001", status: "live" });
    mockUpdateSession.mockResolvedValue({ message: "Session updated" });
  });

  it("calls listSessions on mount", async () => {
    renderWithRouter(<SessionsHistory />, {
      initialEntries: ["/dosen/attendance/jadwal-001/sessions"],
    });
    await waitFor(() => {
      expect(mockListSessions).toHaveBeenCalledWith("jadwal-001", 1, 10);
    });
  });

  it("displays sessions after loading", async () => {
    renderWithRouter(<SessionsHistory />, {
      initialEntries: ["/dosen/attendance/jadwal-001/sessions"],
    });
    await waitFor(() => {
      expect(screen.getAllByText("COMPLETED").length).toBe(2);
    });
    expect(screen.getByText("2026-06-26")).toBeInTheDocument();
    expect(screen.getByText("2026-06-20")).toBeInTheDocument();
    expect(screen.getByText("10 present")).toBeInTheDocument();
  });

  it("shows edit, reopen, delete buttons for completed sessions", async () => {
    renderWithRouter(<SessionsHistory />, {
      initialEntries: ["/dosen/attendance/jadwal-001/sessions"],
    });
    await waitFor(() => {
      expect(screen.getAllByText("COMPLETED").length).toBe(2);
    });
    const editButtons = screen.getAllByText("Edit");
    expect(editButtons.length).toBeGreaterThanOrEqual(1);
    const reopenButtons = screen.getAllByText("Reopen");
    expect(reopenButtons.length).toBeGreaterThanOrEqual(1);
    const deleteButtons = screen.getAllByText("Delete");
    expect(deleteButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("opens edit modal when clicking edit", async () => {
    const user = userEvent.setup();
    renderWithRouter(<SessionsHistory />, {
      initialEntries: ["/dosen/attendance/jadwal-001/sessions"],
    });
    await waitFor(() => {
      expect(screen.getAllByText("COMPLETED").length).toBe(2);
    });
    await user.click(screen.getAllByText("Edit")[0]);
    expect(await screen.findByText("Edit Session")).toBeInTheDocument();
    expect(screen.getByText("Save Changes")).toBeInTheDocument();
  });

  it("opens delete confirmation when clicking delete", async () => {
    const user = userEvent.setup();
    renderWithRouter(<SessionsHistory />, {
      initialEntries: ["/dosen/attendance/jadwal-001/sessions"],
    });
    await waitFor(() => {
      expect(screen.getAllByText("COMPLETED").length).toBe(2);
    });
    await user.click(screen.getAllByText("Delete")[0]);
    expect(await screen.findByText("Delete Session")).toBeInTheDocument();
    expect(screen.getByText("Delete Permanently")).toBeInTheDocument();
  });

  it("opens reopen confirmation when clicking reopen", async () => {
    const user = userEvent.setup();
    renderWithRouter(<SessionsHistory />, {
      initialEntries: ["/dosen/attendance/jadwal-001/sessions"],
    });
    await waitFor(() => {
      expect(screen.getAllByText("COMPLETED").length).toBe(2);
    });
    await user.click(screen.getAllByText("Reopen")[0]);
    await waitFor(() => {
      expect(screen.getAllByText("Reopen Session").length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getByRole("heading", { name: "Reopen Session" })).toBeInTheDocument();
  });
});
