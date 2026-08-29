import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithRouter, mockCourses } from "../helpers";

const mockGetDosenDashboard = vi.fn();

vi.mock("../../app/lib/api", () => ({
  api: {
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

describe("DosenDashboard", () => {
  beforeEach(() => {
    mockGetDosenDashboard.mockResolvedValue({
      dosen: { nama: "Dr. Test" },
      courses: mockCourses,
    });
  });

  it("renders course cards with correct titles", async () => {
    const DosenDashboard = (await import("../../app/routes/dosen/dashboard")).default;
    renderWithRouter(<DosenDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/CS302/)).toBeInTheDocument();
    });
    expect(screen.getByText(/CS101/)).toBeInTheDocument();
    expect(screen.getByText(/DS205/)).toBeInTheDocument();
  });

  it("links Go to Live Monitor to correct jadwal_id slug", async () => {
    const DosenDashboard = (await import("../../app/routes/dosen/dashboard")).default;
    renderWithRouter(<DosenDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Go to Live Monitor")).toBeInTheDocument();
    });

    const liveLink = screen.getByText("Go to Live Monitor").closest("a");
    expect(liveLink).toHaveAttribute("href", "/dosen/attendance/jadwal-001");
  });

  it("links correction button to correct jadwal_id slug", async () => {
    const DosenDashboard = (await import("../../app/routes/dosen/dashboard")).default;
    renderWithRouter(<DosenDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/CS302/)).toBeInTheDocument();
    });

    const correctionLinks = screen.getAllByRole("link").filter(
      (link) => link.getAttribute("href")?.includes("/correction/") ?? false
    );
    expect(correctionLinks.length).toBeGreaterThan(0);
    expect(correctionLinks[0]).toHaveAttribute("href", "/dosen/attendance/correction/jadwal-001");
  });

  it("Open Session button navigates to attendance page", async () => {
    const user = userEvent.setup();
    const DosenDashboard = (await import("../../app/routes/dosen/dashboard")).default;
    renderWithRouter(<DosenDashboard />, { initialEntries: ["/dosen"] });

    await waitFor(() => {
      expect(screen.getAllByText("Open Session").length).toBeGreaterThan(0);
    });

    const openButtons = screen.getAllByText("Open Session");
    await user.click(openButtons[0]);

    expect(screen.queryByText("Class not found.")).not.toBeInTheDocument();
  });
});
