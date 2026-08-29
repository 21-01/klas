import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";

const mockCrudMahasiswa = vi.fn();
const mockCrudDosen = vi.fn();
const mockCrudMataKuliah = vi.fn();
const mockCrudProdi = vi.fn();

vi.mock("../../app/lib/api", () => ({
  api: {
    crudMahasiswa: (...args: any[]) => mockCrudMahasiswa(...args),
    crudDosen: (...args: any[]) => mockCrudDosen(...args),
    crudMataKuliah: (...args: any[]) => mockCrudMataKuliah(...args),
    crudProdi: (...args: any[]) => mockCrudProdi(...args),
  },
}));

vi.mock("../../app/components/Toast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../../app/components/ClickAwayListener", () => ({
  default: ({ children, onClickAway }: any) => (
    <div data-testid="click-away" onClick={onClickAway}>{children}</div>
  ),
}));

import AdminMasterData from "../../app/routes/admin/master-data";

function renderMasterData() {
  const { render } = require("@testing-library/react");
  return render(
    <MemoryRouter initialEntries={["/admin/master-data"]}>
      <AdminMasterData />
    </MemoryRouter>
  );
}

describe("Admin Master Data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCrudMahasiswa.mockResolvedValue({
      mahasiswa: [
        {
          mahasiswa_id: "m1",
          nim: "10221001",
          nama: "Budi Santoso",
          angkatan: "2022",
          jenis_kelamin: "L",
          is_active: true,
          prodi_id: 1,
          program_studi: { nama_prodi: "Teknik Informatika" },
        },
      ],
      pagination: { page: 1, limit: 50, total: 1, total_pages: 1 },
    });
    mockCrudDosen.mockResolvedValue({
      data: [
        {
          dosen_id: "d1",
          nip: "0012345678",
          nama: "Dr. Smith",
          jenis_kelamin: "L",
          is_active: true,
          prodi_id: 1,
          program_studi: { nama_prodi: "Teknik Informatika" },
        },
      ],
      total: 1,
    });
    mockCrudMataKuliah.mockResolvedValue({
      data: [
        {
          mk_id: "mk1",
          kode_mk: "CS101",
          nama_mk: "Intro to CS",
          sks: 3,
          is_active: true,
        },
      ],
      total: 1,
    });
    mockCrudProdi.mockResolvedValue({
      data: [{ prodi_id: 1, nama_prodi: "Teknik Informatika" }],
    });
  });

  it("renders the Master Data Management heading", async () => {
    renderMasterData();
    await waitFor(() => {
      expect(screen.getByText("Master Data Management")).toBeInTheDocument();
    });
  });

  it("renders three tabs: Students, Lecturers, Courses", async () => {
    renderMasterData();
    await waitFor(() => {
      expect(screen.getByText("Students")).toBeInTheDocument();
    });
    expect(screen.getByText("Lecturers")).toBeInTheDocument();
    expect(screen.getByText("Courses")).toBeInTheDocument();
  });

  it("shows student data by default", async () => {
    renderMasterData();
    await waitFor(() => {
      expect(screen.getByText("Budi Santoso")).toBeInTheDocument();
    });
    expect(screen.getByText("10221001")).toBeInTheDocument();
  });

  it("renders Add New Student button", async () => {
    renderMasterData();
    await waitFor(() => {
      expect(screen.getByText(/Add New Student/)).toBeInTheDocument();
    });
  });

  it("renders search input", async () => {
    renderMasterData();
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Search name or NIM/)).toBeInTheDocument();
    });
  });

  it("renders Filter button", async () => {
    renderMasterData();
    await waitFor(() => {
      expect(screen.getByText("Filter")).toBeInTheDocument();
    });
  });

  it("shows empty state when no records match", async () => {
    mockCrudMahasiswa.mockResolvedValue({
      mahasiswa: [],
      pagination: { page: 1, limit: 50, total: 0, total_pages: 0 },
    });
    renderMasterData();
    await waitFor(() => {
      expect(screen.getByText("No records found.")).toBeInTheDocument();
    });
  });
});
