import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithRouter } from "../helpers";
import ClassCard from "../../app/components/ClassCard";

const defaultProps = {
  variant: "in-session" as const,
  time: "08:00 - 10:00",
  title: "Algorithms",
  location: "Ruang 101",
};

describe("ClassCard", () => {
  it("renders the title", () => {
    renderWithRouter(<ClassCard {...defaultProps} />);
    expect(screen.getByText("Algorithms")).toBeInTheDocument();
  });

  it("renders the time range", () => {
    renderWithRouter(<ClassCard {...defaultProps} />);
    expect(screen.getByText("08:00 - 10:00")).toBeInTheDocument();
  });

  it("renders the location", () => {
    renderWithRouter(<ClassCard {...defaultProps} />);
    expect(screen.getByText("Ruang 101")).toBeInTheDocument();
  });

  it("renders lecturer when provided", () => {
    renderWithRouter(<ClassCard {...defaultProps} lecturer="Dr. Smith" />);
    expect(screen.getByText("Dr. Smith")).toBeInTheDocument();
  });

  it("does not render lecturer when not provided", () => {
    renderWithRouter(<ClassCard {...defaultProps} />);
    expect(screen.queryByText(/Dr\./)).not.toBeInTheDocument();
  });

  it("renders action button with correct label and link", () => {
    renderWithRouter(
      <ClassCard {...defaultProps} action={{ label: "SCAN QR", to: "/mahasiswa/scanner" }} />
    );
    const link = screen.getByText("SCAN QR").closest("a");
    expect(link).toHaveAttribute("href", "/mahasiswa/scanner");
  });

  it("does not render action link when no action and variant is in-session", () => {
    renderWithRouter(<ClassCard {...defaultProps} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders IN SESSION pill for in-session variant", () => {
    renderWithRouter(<ClassCard {...defaultProps} variant="in-session" />);
    expect(screen.getByText("IN SESSION")).toBeInTheDocument();
  });

  it("renders CLOSED pill for closed variant", () => {
    renderWithRouter(<ClassCard {...defaultProps} variant="closed" />);
    expect(screen.getByText("CLOSED")).toBeInTheDocument();
  });

  it("renders UPCOMING pill for upcoming variant", () => {
    renderWithRouter(<ClassCard {...defaultProps} variant="upcoming" />);
    expect(screen.getByText("UPCOMING")).toBeInTheDocument();
  });
});
