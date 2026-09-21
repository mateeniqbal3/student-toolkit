// @vitest-environment node
// Reads the style sources from disk, which jsdom's http-scheme module URLs cannot.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { CITATION_STYLES, getStyle } from "./styles";
import { CSL_SOURCES, minifyCsl } from "./styles/minify";
import { CITATION_STYLE_IDS } from "./types";

const STYLE_DIR = fileURLToPath(new URL("./styles/", import.meta.url));

describe("citation styles", () => {
  it("has one definition for every style id", () => {
    expect(CITATION_STYLES.map((style) => style.id).sort()).toEqual([...CITATION_STYLE_IDS].sort());
    expect(Object.keys(CSL_SOURCES).sort()).toEqual([...CITATION_STYLE_IDS].sort());
  });

  // If this fails, a .csl file was replaced without running `npm run styles`.
  it.each(Object.entries(CSL_SOURCES))("ships the current %s rules", async (id, file) => {
    const source = minifyCsl(await readFile(`${STYLE_DIR}${file}`, "utf8"));
    expect(await getStyle(id).load()).toBe(source);
  });

  it("keeps each style's licence and attribution when minifying", async () => {
    const xml = await getStyle("apa").load();
    expect(xml).toContain("creativecommons.org/licenses/by-sa/3.0");
    expect(xml).not.toContain("<!--");
  });

  it("falls back to APA for an unknown id", () => {
    expect(getStyle("vancouver").id).toBe("apa");
  });
});
