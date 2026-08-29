import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";

const mockGetAdminDashboard = vi.fn();

vi.mock("../../app/lib/api", () => ({
  api: {
    getAdminDashboard: (...args: any[]) => mockGetAdminDashboard(...args),
  },
}));

vi.mock("../../app/components/Toast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import AdminDashboard from "../../app/routes/admin/dashboard";

function renderDashboard() {
  const { render } = require("@testing-library/react");
  return render(
    <MemoryRouter initialEntries={["/admin"]}>
      <AdminDashboard />
    </MemoryRouter>
  );
}

describe("Admin Dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAdminDashboard.mockResolvedValue({
      active_sessions_today: 5,
      overall_attendance_rate: 87,
      geofence_violations: 3,
      total_students: 200,
      total_lecturers: 25,
      total_courses: 30,
      total_rooms: 15,
      total_enrollments: 500,
      students_with_low_attendance: 12,
      completed_sessions_today: 10,
      total_sessions_all_time: 500,
      attendance_trend: [
        { date: "2026-06-25", present_count: 80, absent_count: 20 },
        { date: "2026-06-26", present_count: 90, absent_count: 10 },
      ],
    });
  });

  it("renders the Academic Analytics heading", async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/Academic Analytics/)).toBeInTheDocument();
    });
  });

  it("renders active sessions stat", async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/5 Sessions/)).toBeInTheDocument();
    });
  });

  it("renders attendance rate stat", async () => {
    renderDashboard();
    await waitFor(() => {
      const els = screen.getAllByText("87%");
      expect(els.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders geofence violations", async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/3 flags/)).toBeInTheDocument();
    });
  });

  it("renders total students stat", async () => {
    renderDashboard();
    await waitFor(() => {
      const els = screen.getAllByText("200");
      expect(els.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders summary section with lecturer count", async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/Lecturers: 25/)).toBeInTheDocument();
    });
  });

  it("renders summary section with course count", async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/Courses: 30/)).toBeInTheDocument();
    });
  });

  it("renders system overview table", async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText("System Overview")).toBeInTheDocument();
    });
  });

  it("renders search input in system overview", async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();
    });
  });

  it("renders attendance trend chart section", async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText("Attendance Trends")).toBeInTheDocument();
    });
  });

  it("shows loading spinner initially", () => {
    const { container } = renderDashboard();
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });
});
