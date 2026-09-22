import { describe, expect, it } from "vitest";

import { baseName, formatBytes, looksLikePdf, savedPercent } from "./files";

describe("file helpers", () => {
  it("formats sizes as file managers do", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1_400)).toBe("1.4 KB");
    expect(formatBytes(2_500_000)).toBe("2.5 MB");
    expect(formatBytes(250_000_000)).toBe("250 MB");
  });

  it("strips one extension", () => {
    expect(baseName("Lecture 4.PDF")).toBe("Lecture 4");
    expect(baseName("notes.v2.pdf")).toBe("notes.v2");
    expect(baseName("README")).toBe("README");
  });

  it("reports savings, and growth as negative", () => {
    expect(savedPercent(1000, 400)).toBe(60);
    expect(savedPercent(1000, 1100)).toBe(-10);
  });

  it("recognises a PDF by its header", () => {
    expect(looksLikePdf(new TextEncoder().encode("%PDF-1.7\n..."))).toBe(true);
    expect(looksLikePdf(new TextEncoder().encode("PK\u0003\u0004 zip"))).toBe(false);
  });
});
