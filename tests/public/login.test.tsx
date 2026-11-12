import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import React from "react";

const { mockSignIn, mockGetMyProfile, mockNavigate } = vi.hoisted(() => ({
  mockSignIn: vi.fn(),
  mockGetMyProfile: vi.fn(),
  mockNavigate: vi.fn(),
}));

vi.mock("../../app/lib/auth", () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
}));

vi.mock("../../app/lib/api", () => ({
  api: { getMyProfile: (...args: unknown[]) => mockGetMyProfile(...args) },
  clearProfileCache: vi.fn(),
}));

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

import LoginPage from "../../app/routes/login";

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <LoginPage />
    </MemoryRouter>
  );
}

describe("Login Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignIn.mockResolvedValue(undefined);
    mockGetMyProfile.mockResolvedValue({ role: "mahasiswa" });
  });

  it("renders the login form with email and password fields", () => {
    renderLogin();
    expect(screen.getByLabelText(/Campus Email/i)).toBeInTheDocument();
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
    await user.type(screen.getByLabelText(/Campus Email/i), "testuser");
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
    mockSignIn.mockRejectedValue(new Error("Invalid login credentials"));

    renderLogin();
    await user.type(screen.getByLabelText(/Campus Email/i), "test@mhs.unj.ac.id");
    await user.type(screen.getByLabelText(/Password/i), "wrongpassword");
    await user.click(screen.getByRole("button", { name: /Sign In/i }));

    await waitFor(() => {
      expect(screen.getByText("Invalid login credentials")).toBeInTheDocument();
    });
  });

  it("redirects to the role dashboard after a successful sign in", async () => {
    const user = userEvent.setup();
    mockGetMyProfile.mockResolvedValue({ role: "dosen" });

    renderLogin();
    await user.type(screen.getByLabelText(/Campus Email/i), "samudra.adi@unj.ac.id");
    await user.type(screen.getByLabelText(/Password/i), "KlasDemo#2026");
    await user.click(screen.getByRole("button", { name: /Sign In/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/dosen");
    });
  });
});
