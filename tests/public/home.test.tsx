import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithRouter } from "../helpers";
import Home from "../../app/routes/home";

describe("Home Page", () => {
  it("renders the KLAS brand name in the header", () => {
    renderWithRouter(<Home />);
    expect(screen.getByText("KLAS")).toBeInTheDocument();
  });

  it("renders the Sign In link in the header", () => {
    renderWithRouter(<Home />);
    const signIn = screen.getByText("Sign In");
    expect(signIn).toBeInTheDocument();
    expect(signIn.closest("a")).toHaveAttribute("href", "/login");
  });

  it("renders the hero heading", () => {
    renderWithRouter(<Home />);
    expect(screen.getByText(/Your Location/)).toBeInTheDocument();
    expect(screen.getByText(/Your Attendance/)).toBeInTheDocument();
  });

  it("renders the Get Started CTA linking to /login", () => {
    renderWithRouter(<Home />);
    const cta = screen.getByText("Get Started");
    expect(cta).toBeInTheDocument();
    expect(cta.closest("a")).toHaveAttribute("href", "/login");
  });

  it("renders all three feature cards", () => {
    renderWithRouter(<Home />);
    expect(screen.getByText("Dynamic QR")).toBeInTheDocument();
    expect(screen.getByText("GPS Geofencing")).toBeInTheDocument();
    expect(screen.getByText("IP Filtering")).toBeInTheDocument();
  });

  it("renders feature card descriptions", () => {
    renderWithRouter(<Home />);
    expect(screen.getByText(/Time-limited QR codes/)).toBeInTheDocument();
    expect(screen.getByText(/Spatial verification using PostGIS/)).toBeInTheDocument();
    expect(screen.getByText(/Campus network whitelist/)).toBeInTheDocument();
  });

  it("renders the footer text", () => {
    renderWithRouter(<Home />);
    expect(screen.getByText(/KLAS — Geospatial Presence Verification System/)).toBeInTheDocument();
  });
});
