import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";

const mockGetAuditLogs = vi.fn();

vi.mock("../../app/lib/api", () => ({
  api: {
    getAuditLogs: (...args: any[]) => mockGetAuditLogs(...args),
  },
}));

vi.mock("../../app/components/Toast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import AdminAuditLogs from "../../app/routes/admin/audit-logs";

function renderAuditLogs() {
  const { render } = require("@testing-library/react");
  return render(
    <MemoryRouter initialEntries={["/admin/audit-logs"]}>
      <AdminAuditLogs />
    </MemoryRouter>
  );
}

describe("Admin Audit Logs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuditLogs.mockResolvedValue({
      logs: [
        {
          log_id: "l1",
          timestamp: "2026-06-26T08:00:00Z",
          kategori: "Authentication",
          aksi: "Successful login for admin",
          ip_address: "192.168.1.1",
          status: "success",
          users: { name: "Admin User", email: "admin@test.com" },
        },
        {
          log_id: "l2",
          timestamp: "2026-06-26T09:00:00Z",
          kategori: "Security Policies",
          aksi: "Failed login attempt",
          ip_address: "10.0.0.1",
          status: "failed",
          users: { name: "Unknown", email: "" },
        },
      ],
      pagination: { page: 1, limit: 50, total: 2, total_pages: 1 },
    });
  });

  it("renders the System Audit Logs heading", async () => {
    renderAuditLogs();
    await waitFor(() => {
      expect(screen.getByText("System Audit Logs")).toBeInTheDocument();
    });
  });

  it("renders the Export CSV button", async () => {
    renderAuditLogs();
    await waitFor(() => {
      expect(screen.getByText("Export CSV")).toBeInTheDocument();
    });
  });

  it("renders log entries with action text", async () => {
    renderAuditLogs();
    await waitFor(() => {
      expect(screen.getByText("Successful login for admin")).toBeInTheDocument();
    });
    expect(screen.getByText("Failed login attempt")).toBeInTheDocument();
  });

  it("renders user names in log entries", async () => {
    renderAuditLogs();
    await waitFor(() => {
      expect(screen.getByText("Admin User")).toBeInTheDocument();
    });
  });

  it("renders IP addresses", async () => {
    renderAuditLogs();
    await waitFor(() => {
      expect(screen.getByText("192.168.1.1")).toBeInTheDocument();
    });
    expect(screen.getByText("10.0.0.1")).toBeInTheDocument();
  });

  it("renders status badges", async () => {
    renderAuditLogs();
    await waitFor(() => {
      expect(screen.getByText("Success")).toBeInTheDocument();
    });
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });

  it("renders category badges", async () => {
    renderAuditLogs();
    await waitFor(() => {
      const authEls = screen.getAllByText("Authentication");
      expect(authEls.length).toBeGreaterThanOrEqual(1);
    });
    const securityEls = screen.getAllByText("Security Policies");
    expect(securityEls.length).toBeGreaterThanOrEqual(1);
  });

  it("renders search input", async () => {
    renderAuditLogs();
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Search by action/)).toBeInTheDocument();
    });
  });

  it("renders category filter dropdown", async () => {
    renderAuditLogs();
    await waitFor(() => {
      expect(screen.getByDisplayValue("All Categories")).toBeInTheDocument();
    });
  });

  it("renders time filter dropdown", async () => {
    renderAuditLogs();
    await waitFor(() => {
      expect(screen.getByDisplayValue("All Dates")).toBeInTheDocument();
    });
  });

  it("shows read-only notice", async () => {
    renderAuditLogs();
    await waitFor(() => {
      expect(screen.getByText(/Audit logs are read-only/)).toBeInTheDocument();
    });
  });

  it("shows empty state when no logs match", async () => {
    mockGetAuditLogs.mockResolvedValue({
      logs: [],
      pagination: { page: 1, limit: 50, total: 0, total_pages: 0 },
    });
    renderAuditLogs();
    await waitFor(() => {
      expect(screen.getByText(/No audit records match/)).toBeInTheDocument();
    });
  });
});
