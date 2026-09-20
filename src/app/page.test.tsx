import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "./page";

describe("landing page", () => {
  it("names the product in the top-level heading", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Student Toolkit");
  });

  it("lists all nine tools", () => {
    render(<Home />);
    const list = screen.getByRole("list", { name: /shipping soon/i });
    expect(within(list).getAllByRole("listitem")).toHaveLength(9);
  });

  it("states the local-first privacy guarantee", () => {
    render(<Home />);
    expect(screen.getByText(/never leave your device/i)).toBeInTheDocument();
  });
});
