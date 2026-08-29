import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import React from "react";

const mockSignInWithPassword = vi.fn();
const mockFrom = vi.fn();
const mockRpc = vi.fn();

vi.mock("../../app/lib/supabase", () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: any[]) => mockSignInWithPassword(...args),
    },
    from: (...args: any[]) => mockFrom(...args),
    rpc: (...args: any[]) => mockRpc(...args),
  },
}));

import LoginPage from "../../app/routes/login";

function renderLogin() {
  const { render } = require("@testing-library/react");
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <LoginPage />
    </MemoryRouter>
  );
}

describe("Login Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    });
    mockRpc.mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({
        data: { role: "mahasiswa", name: "Test User" },
        error: null,
      }),
    });
  });

  it("renders the login form with campus ID and password fields", () => {
    renderLogin();
    expect(screen.getByLabelText(/Campus ID/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
  });

  it("renders the Sign In button", () => {
    renderLogin();
    expect(screen.getByRole("button", { name: /Sign In/i })).toBeInTheDocument();
  });

  it("shows error when submitting empty form", async () => {
    const user = userEvent.setup();
    renderLogin();
    await user.click(screen.getByRole("button", { name: /Sign In/i }));
    expect(screen.getByText(/Campus ID \/ Email is required/)).toBeInTheDocument();
  });

  it("shows error when password is empty", async () => {
    const user = userEvent.setup();
    renderLogin();
    await user.type(screen.getByLabelText(/Campus ID/i), "testuser");
    await user.click(screen.getByRole("button", { name: /Sign In/i }));
    expect(screen.getByText(/Password is required/)).toBeInTheDocument();
  });

  it("toggles password visibility", async () => {
    const user = userEvent.setup();
    renderLogin();
    const passwordInput = screen.getByLabelText(/Password/i);
    expect(passwordInput).toHaveAttribute("type", "password");

    const toggleBtn = screen.getByRole("button", { name: "" });
    await user.click(toggleBtn);
    expect(passwordInput).toHaveAttribute("type", "text");
  });

  it("shows error on invalid credentials", async () => {
    const user = userEvent.setup();
    mockSignInWithPassword.mockResolvedValue({
      data: null,
      error: { message: "Invalid login credentials" },
    });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { users: { email: "test@test.com" } },
            error: null,
          }),
        }),
      }),
    });

    renderLogin();
    await user.type(screen.getByLabelText(/Campus ID/i), "10221001");
    await user.type(screen.getByLabelText(/Password/i), "wrongpassword");
    await user.click(screen.getByRole("button", { name: /Sign In/i }));

    await waitFor(() => {
      expect(screen.getByText("Invalid login credentials")).toBeInTheDocument();
    });
  });
});
