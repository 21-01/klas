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

vi.mock("../../app/lib/supabase", () => ({
  supabase: {
    auth: {
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

vi.mock("../../app/components/Toast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("Mahasiswa Profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoaderDataFn.mockReturnValue({
      initials: "BS",
      name: "Budi Santoso",
      classInfo: "Teknik Informatika • Class of 2022",
      gpa: "3.75",
      studentId: "10221001",
      email: "budi@mhs.unj.ac.id",
      advisor: "Dr. Smith",
    });
  });

  it("renders student name", async () => {
    const Profile = (await import("../../app/routes/profile")).default;
    render(
      <MemoryRouter initialEntries={["/mahasiswa/profile"]}>
        <Profile />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Budi Santoso")).toBeInTheDocument();
    });
  });

  it("renders student initials avatar", async () => {
    const Profile = (await import("../../app/routes/profile")).default;
    render(
      <MemoryRouter initialEntries={["/mahasiswa/profile"]}>
        <Profile />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("BS")).toBeInTheDocument();
    });
  });

  it("renders class info", async () => {
    const Profile = (await import("../../app/routes/profile")).default;
    render(
      <MemoryRouter initialEntries={["/mahasiswa/profile"]}>
        <Profile />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Teknik Informatika • Class of 2022")).toBeInTheDocument();
    });
  });

  it("renders GPA", async () => {
    const Profile = (await import("../../app/routes/profile")).default;
    render(
      <MemoryRouter initialEntries={["/mahasiswa/profile"]}>
        <Profile />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/GPA: 3.75/)).toBeInTheDocument();
    });
  });

  it("renders student ID", async () => {
    const Profile = (await import("../../app/routes/profile")).default;
    render(
      <MemoryRouter initialEntries={["/mahasiswa/profile"]}>
        <Profile />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("10221001")).toBeInTheDocument();
    });
  });

  it("renders email", async () => {
    const Profile = (await import("../../app/routes/profile")).default;
    render(
      <MemoryRouter initialEntries={["/mahasiswa/profile"]}>
        <Profile />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("budi@mhs.unj.ac.id")).toBeInTheDocument();
    });
  });

  it("renders academic advisor", async () => {
    const Profile = (await import("../../app/routes/profile")).default;
    render(
      <MemoryRouter initialEntries={["/mahasiswa/profile"]}>
        <Profile />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Dr. Smith")).toBeInTheDocument();
    });
  });

  it("renders sign out button", async () => {
    const Profile = (await import("../../app/routes/profile")).default;
    render(
      <MemoryRouter initialEntries={["/mahasiswa/profile"]}>
        <Profile />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Sign Out")).toBeInTheDocument();
    });
  });
});
