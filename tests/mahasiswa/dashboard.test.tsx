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

describe("Mahasiswa Dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders today's classes with correct titles", async () => {
    mockLoaderDataFn.mockReturnValue({
      date: "Saturday, Jun 28",
      classes: [
        {
          jadwal_id: "j1",
          mata_kuliah: { kode_mk: "CS101", nama_mk: "Intro to CS", sks: 3 },
          waktu_mulai: "08:00", waktu_selesai: "10:00",
          ruangan: "Ruang 101", sesi_id: "s1", sesi_status: "live",
        },
      ],
    });
    const Dashboard = (await import("../../app/routes/dashboard")).default;
    render(
      <MemoryRouter initialEntries={["/mahasiswa"]}>
        <Dashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Intro to CS")).toBeInTheDocument();
    });
  });

  it("renders SCAN QR button for classes with active session", async () => {
    mockLoaderDataFn.mockReturnValue({
      date: "Saturday, Jun 28",
      classes: [
        {
          jadwal_id: "j1",
          mata_kuliah: { kode_mk: "CS101", nama_mk: "Intro to CS", sks: 3 },
          waktu_mulai: "08:00", waktu_selesai: "10:00",
          ruangan: "Ruang 101", sesi_id: "s1", sesi_status: "live",
        },
      ],
    });
    const Dashboard = (await import("../../app/routes/dashboard")).default;
    render(
      <MemoryRouter initialEntries={["/mahasiswa"]}>
        <Dashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("SCAN QR")).toBeInTheDocument();
    });
  });

  it("shows empty state when no classes scheduled", async () => {
    mockLoaderDataFn.mockReturnValue({
      date: "Saturday, Jun 28",
      classes: [],
    });
    const Dashboard = (await import("../../app/routes/dashboard")).default;
    render(
      <MemoryRouter initialEntries={["/mahasiswa"]}>
        <Dashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/No classes scheduled for today/)).toBeInTheDocument();
    });
  });

  it("renders upcoming class without SCAN QR button", async () => {
    mockLoaderDataFn.mockReturnValue({
      date: "Saturday, Jun 28",
      classes: [
        {
          jadwal_id: "j2",
          mata_kuliah: { kode_mk: "CS201", nama_mk: "Data Structures", sks: 3 },
          waktu_mulai: "13:00", waktu_selesai: "15:00",
          ruangan: "Ruang 202", sesi_id: null, sesi_status: null,
        },
      ],
    });
    const Dashboard = (await import("../../app/routes/dashboard")).default;
    render(
      <MemoryRouter initialEntries={["/mahasiswa"]}>
        <Dashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Data Structures")).toBeInTheDocument();
    });
    expect(screen.queryByText("SCAN QR")).not.toBeInTheDocument();
  });
});
