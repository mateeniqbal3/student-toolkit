import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TOOLS } from "@/lib/tools";
import Home from "./page";

describe("landing page", () => {
  it("leads with the offline promise in the top-level heading", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/work offline/i);
  });

  it("links to every tool", () => {
    render(<Home />);
    const list = screen.getByRole("list", { name: /the tools/i });
    const links = within(list).getAllByRole("link");

    expect(links).toHaveLength(TOOLS.length);
    expect(links.map((link) => link.getAttribute("href"))).toEqual(
      TOOLS.map((tool) => `/${tool.slug}`),
    );
  });

  it("flags the one tool that needs a connection", () => {
    render(<Home />);
    expect(screen.getAllByText(/needs a connection/i)).toHaveLength(1);
  });

  it("states the local-first privacy guarantee", () => {
    render(<Home />);
    expect(screen.getByText(/stored in your browser/i)).toBeInTheDocument();
  });
});
