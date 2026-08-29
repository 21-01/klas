import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";

const mockGetDosenDashboard = vi.fn();
const mockGetDosenReport = vi.fn();
const mockExportReport = vi.fn();

vi.mock("../../app/lib/api", () => ({
  api: {
    getDosenDashboard: (...args: any[]) => mockGetDosenDashboard(...args),
    getDosenReport: (...args: any[]) => mockGetDosenReport(...args),
    exportReport: (...args: any[]) => mockExportReport(...args),
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

import DosenReport from "../../app/routes/dosen/report";

function renderReport() {
  const { render } = require("@testing-library/react");
  return render(
    <MemoryRouter initialEntries={["/dosen/report"]}>
      <DosenReport />
    </MemoryRouter>
  );
}

describe("Dosen Report", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDosenDashboard.mockResolvedValue({
      courses: [
        {
          jadwal_id: "j1",
          mata_kuliah: { kode_mk: "CS101", nama_mk: "Intro to CS" },
          latest_session: { status: "completed" },
        },
      ],
    });
    mockGetDosenReport.mockResolvedValue({
      course: { kode_mk: "CS101", nama_mk: "Intro to CS" },
      overall_attendance_rate: 85,
      total_sessions: 10,
      total_students: 40,
      students: [
        {
          nama: "Budi Santoso",
          nim: "10221001",
          gpa: 3.5,
          attendance: { present: 8, absent: 1, excused: 1 },
          rate: 80,
        },
      ],
    });
    mockExportReport.mockResolvedValue("nim,name,rate\n10221001,Budi,80");
  });

  it("renders the Academic Dashboard heading", async () => {
    renderReport();
    await waitFor(() => {
      expect(screen.getByText("Academic Dashboard")).toBeInTheDocument();
    });
  });

  it("renders course code and name in stats", async () => {
    renderReport();
    await waitFor(() => {
      expect(screen.getByText("CS101")).toBeInTheDocument();
    });
    expect(screen.getByText("Intro to CS")).toBeInTheDocument();
  });

  it("renders attendance rate", async () => {
    renderReport();
    await waitFor(() => {
      expect(screen.getByText("85%")).toBeInTheDocument();
    });
  });

  it("renders total sessions count", async () => {
    renderReport();
    await waitFor(() => {
      expect(screen.getByText("10")).toBeInTheDocument();
    });
  });

  it("renders student data in the table", async () => {
    renderReport();
    await waitFor(() => {
      expect(screen.getByText("Budi Santoso")).toBeInTheDocument();
    });
    expect(screen.getByText("10221001")).toBeInTheDocument();
  });

  it("renders Export CSV button", async () => {
    renderReport();
    await waitFor(() => {
      expect(screen.getByText("Export CSV")).toBeInTheDocument();
    });
  });

  it("renders course selector dropdown", async () => {
    renderReport();
    await waitFor(() => {
      expect(screen.getByDisplayValue(/CS101/)).toBeInTheDocument();
    });
  });

  it("renders search input for course history", async () => {
    renderReport();
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Search code or title/)).toBeInTheDocument();
    });
  });
});
