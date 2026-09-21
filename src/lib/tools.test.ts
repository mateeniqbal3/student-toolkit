import { describe, expect, it } from "vitest";

import { getTool, TOOL_SLUGS, TOOLS } from "./tools";

describe("tool registry", () => {
  it("contains all ten tools", () => {
    expect(TOOLS).toHaveLength(10);
  });

  it("has unique slugs", () => {
    expect(new Set(TOOL_SLUGS).size).toBe(TOOLS.length);
  });

  it("uses url-safe, lowercase slugs so the routes stay indexable", () => {
    for (const slug of TOOL_SLUGS) {
      expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it("gives every tool the copy the cards and metadata need", () => {
    for (const tool of TOOLS) {
      expect(tool.name.length).toBeGreaterThan(0);
      expect(tool.tagline.length).toBeGreaterThan(0);
      // Search engines truncate around 160 characters, so a description
      // shorter than that is wasted space and much longer is cut off.
      expect(tool.description.length).toBeGreaterThan(80);
      expect(tool.keywords.length).toBeGreaterThan(0);
    }
  });

  it("marks only the AI assistant as needing a connection", () => {
    const online = TOOLS.filter((tool) => !tool.offline).map((tool) => tool.slug);
    expect(online).toEqual(["ai-assistant"]);
  });

  it("looks tools up by slug and returns undefined for unknown ones", () => {
    expect(getTool("gpa-calculator")?.name).toBe("GPA & CGPA Calculator");
    expect(getTool("not-a-tool")).toBeUndefined();
  });
});
