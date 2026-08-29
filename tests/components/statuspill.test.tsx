import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithRouter } from "../helpers";
import StatusPill from "../../app/components/StatusPill";

describe("StatusPill", () => {
  it("renders IN SESSION for in-session variant", () => {
    renderWithRouter(<StatusPill variant="in-session" />);
    expect(screen.getByText("IN SESSION")).toBeInTheDocument();
  });

  it("renders CLOSED for closed variant", () => {
    renderWithRouter(<StatusPill variant="closed" />);
    expect(screen.getByText("CLOSED")).toBeInTheDocument();
  });

  it("renders UPCOMING for upcoming variant", () => {
    renderWithRouter(<StatusPill variant="upcoming" />);
    expect(screen.getByText("UPCOMING")).toBeInTheDocument();
  });
});
