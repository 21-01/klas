import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithRouter, mockCourses, mockLiveSession, mockQrTokenBatch } from "../helpers";

const mockGetDosenDashboard = vi.fn();
const mockGetLiveSession = vi.fn();
const mockGenerateQrTokens = vi.fn();
const mockCloseSession = vi.fn();
const mockUpdateSessionSettings = vi.fn();

vi.mock("../../app/lib/api", () => ({
  api: {
    getDosenDashboard: (...args: any[]) => mockGetDosenDashboard(...args),
    getLiveSession: (...args: any[]) => mockGetLiveSession(...args),
    generateQrTokens: (...args: any[]) => mockGenerateQrTokens(...args),
    closeSession: (...args: any[]) => mockCloseSession(...args),
    updateSessionSettings: (...args: any[]) => mockUpdateSessionSettings(...args),
  },
}));

vi.mock("../../app/components/Toast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="recharts-container">{children}</div>,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => null,
  Cell: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));

vi.mock("react-qr-code", () => ({
  default: (props: any) => <div data-testid="qr-code">QR Code</div>,
}));

const liveCourse = mockCourses.find((c) => c.jadwal_id === "jadwal-001")!;

describe("DosenAttendance jadwal_id routing", () => {
  beforeEach(() => {
    mockGetDosenDashboard.mockResolvedValue({ dosen: { nama: "Dr. Test" }, courses: mockCourses });
    mockGetLiveSession.mockResolvedValue(mockLiveSession);
    mockGenerateQrTokens.mockResolvedValue(mockQrTokenBatch);
    mockCloseSession.mockResolvedValue({ message: "Session closed" });
    mockUpdateSessionSettings.mockResolvedValue({ message: "Settings updated" });
  });

  it("reads jadwal_id from URL params and resolves sesi", async () => {
    const DosenAttendance = (await import("../../app/routes/dosen/attendance")).default;
    renderWithRouter(<DosenAttendance />, {
      initialEntries: ["/dosen/attendance/jadwal-001"],
    });

    await waitFor(() => {
      expect(mockGetLiveSession).toHaveBeenCalledWith(liveCourse.latest_session!.sesi_id);
    });
  });

  it("displays session info after loading", async () => {
    const DosenAttendance = (await import("../../app/routes/dosen/attendance")).default;
    renderWithRouter(<DosenAttendance />, {
      initialEntries: ["/dosen/attendance/jadwal-001"],
    });

    await waitFor(() => {
      expect(screen.getByText("Session Overview")).toBeInTheDocument();
    });
  });

  it("shows QR code section for live sessions", async () => {
    const DosenAttendance = (await import("../../app/routes/dosen/attendance")).default;
    renderWithRouter(<DosenAttendance />, {
      initialEntries: ["/dosen/attendance/jadwal-001"],
    });

    await waitFor(() => {
      expect(screen.getByTestId("qr-code")).toBeInTheDocument();
    });
  });

  it("links Correction to correct jadwal_id slug", async () => {
    const DosenAttendance = (await import("../../app/routes/dosen/attendance")).default;
    renderWithRouter(<DosenAttendance />, {
      initialEntries: ["/dosen/attendance/jadwal-001"],
    });

    await waitFor(() => {
      expect(screen.getByText("Session Overview")).toBeInTheDocument();
    });

    const correctionLink = screen.getByText("Manual Correction").closest("a");
    expect(correctionLink).toHaveAttribute("href", "/dosen/attendance/correction/jadwal-001");
  });

  it("shows empty state when no course matches jadwal_id", async () => {
    mockGetDosenDashboard.mockResolvedValue({ dosen: { nama: "Dr. Test" }, courses: [] });

    const DosenAttendance = (await import("../../app/routes/dosen/attendance")).default;
    renderWithRouter(<DosenAttendance />, {
      initialEntries: ["/dosen/attendance/nonexistent-jadwal"],
    });

    await waitFor(() => {
      expect(screen.getByText("Class not found.")).toBeInTheDocument();
    });
  });
});
