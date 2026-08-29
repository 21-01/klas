import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import React from "react";

const mockLoaderDataFn = vi.fn();

vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    useLoaderData: () => mockLoaderDataFn(),
  };
});

vi.mock("../../app/components/Toast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("Mahasiswa Logs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders academic standing header", async () => {
    mockLoaderDataFn.mockReturnValue({
      logs: [],
      attendance: "85%",
      semester: "Ganjil 2026",
    });
    const Logs = (await import("../../app/routes/logs")).default;
    render(
      <MemoryRouter initialEntries={["/mahasiswa/logs"]}>
        <Logs />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Total Attendance: 85%/)).toBeInTheDocument();
    });
  });

  it("renders semester info", async () => {
    mockLoaderDataFn.mockReturnValue({
      logs: [],
      attendance: "90%",
      semester: "Ganjil 2026",
    });
    const Logs = (await import("../../app/routes/logs")).default;
    render(
      <MemoryRouter initialEntries={["/mahasiswa/logs"]}>
        <Logs />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Ganjil 2026")).toBeInTheDocument();
    });
  });

  it("renders empty state when no logs", async () => {
    mockLoaderDataFn.mockReturnValue({
      logs: [],
      attendance: "0%",
      semester: "Current Semester",
    });
    const Logs = (await import("../../app/routes/logs")).default;
    render(
      <MemoryRouter initialEntries={["/mahasiswa/logs"]}>
        <Logs />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/No attendance records found/)).toBeInTheDocument();
    });
  });

  it("renders attendance log entries", async () => {
    mockLoaderDataFn.mockReturnValue({
      logs: [
        {
          presensi_id: "p1",
          status: "present",
          waktu_check_in: "2026-06-26T08:05:00Z",
          sesi_kehadiran: {
            jadwal_kelas: { mata_kuliah: { nama_mk: "Algorithms" } },
          },
        },
        {
          presensi_id: "p2",
          status: "absent",
          waktu_check_in: "2026-06-25T10:00:00Z",
          sesi_kehadiran: {
            jadwal_kelas: { mata_kuliah: { nama_mk: "Data Structures" } },
          },
        },
      ],
      attendance: "75%",
      semester: "Ganjil 2026",
    });
    const Logs = (await import("../../app/routes/logs")).default;
    render(
      <MemoryRouter initialEntries={["/mahasiswa/logs"]}>
        <Logs />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Algorithms")).toBeInTheDocument();
    });
    expect(screen.getByText("Data Structures")).toBeInTheDocument();
  });

  it("renders download full report button", async () => {
    mockLoaderDataFn.mockReturnValue({
      logs: [],
      attendance: "85%",
      semester: "Ganjil 2026",
    });
    const Logs = (await import("../../app/routes/logs")).default;
    render(
      <MemoryRouter initialEntries={["/mahasiswa/logs"]}>
        <Logs />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/DOWNLOAD FULL REPORT/)).toBeInTheDocument();
    });
  });
});
