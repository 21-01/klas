import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithRouter, mockCourses, mockCourseStudents } from "../helpers";

const mockGetDosenDashboard = vi.fn();
const mockGetCourseStudents = vi.fn();
const mockCorrectAttendance = vi.fn();
const mockListSessions = vi.fn();

vi.mock("../../app/lib/api", () => ({
  api: {
    getDosenDashboard: (...args: any[]) => mockGetDosenDashboard(...args),
    getCourseStudents: (...args: any[]) => mockGetCourseStudents(...args),
    correctAttendance: (...args: any[]) => mockCorrectAttendance(...args),
    listSessions: (...args: any[]) => mockListSessions(...args),
  },
}));

vi.mock("../../app/components/Toast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("DosenCorrection jadwal_id routing", () => {
  beforeEach(() => {
    mockGetDosenDashboard.mockResolvedValue({ dosen: { nama: "Dr. Test" }, courses: mockCourses });
    mockGetCourseStudents.mockResolvedValue(mockCourseStudents);
    mockCorrectAttendance.mockResolvedValue({ message: "Corrected" });
    mockListSessions.mockResolvedValue({
      sessions: [
        { sesi_id: "sesi-001", jadwal_id: "jadwal-001", tanggal: "2026-06-27", status: "completed" },
        { sesi_id: "sesi-002", jadwal_id: "jadwal-001", tanggal: "2026-06-20", status: "completed" },
      ],
      pagination: { page: 1, limit: 10, total: 2, total_pages: 1 },
    });
  });

  it("initializes selected jadwal from URL param", async () => {
    const DosenCorrection = (await import("../../app/routes/dosen/correction")).default;
    renderWithRouter(<DosenCorrection />, {
      initialEntries: ["/dosen/attendance/correction/jadwal-001"],
    });

    await waitFor(() => {
      expect(mockGetCourseStudents).toHaveBeenCalledWith(
        expect.objectContaining({ jadwal_id: "jadwal-001" })
      );
    });
  });

  it("navigates to new slug when course dropdown changes", async () => {
    const user = userEvent.setup();
    const DosenCorrection = (await import("../../app/routes/dosen/correction")).default;
    renderWithRouter(<DosenCorrection />, {
      initialEntries: ["/dosen/attendance/correction/jadwal-001"],
    });

    await waitFor(() => {
      expect(mockGetCourseStudents).toHaveBeenCalled();
    });

    const selects = screen.getAllByRole("combobox");
    const courseSelect = selects[0];
    await user.selectOptions(courseSelect, "jadwal-002");
    expect(courseSelect).toHaveValue("jadwal-002");
  });

  it("back button links to /dosen/attendance/:jadwal_id", async () => {
    const DosenCorrection = (await import("../../app/routes/dosen/correction")).default;
    renderWithRouter(<DosenCorrection />, {
      initialEntries: ["/dosen/attendance/correction/jadwal-001"],
    });

    await waitFor(() => {
      expect(screen.getByText("Manual Attendance Correction")).toBeInTheDocument();
    });

    const backLink = screen.getAllByRole("link").find(
      (link) => link.getAttribute("href") === "/dosen/attendance/jadwal-001"
    );
    expect(backLink).toBeDefined();
    expect(backLink).toHaveAttribute("href", "/dosen/attendance/jadwal-001");
  });
});
