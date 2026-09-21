import { describe, expect, it } from "vitest";

import {
  bibliographyClipboardHtml,
  bibliographyText,
  exportSources,
  formatBibliography,
  sanitizeCitationHtml,
} from "./format";
import type { CslItem } from "./types";

const ARTICLE: CslItem = {
  id: "1",
  type: "article-journal",
  title: "Measured measurement",
  author: [{ family: "Aspelmeyer", given: "Markus" }],
  issued: { "date-parts": [[2009, 1]] },
  "container-title": "Nature Physics",
  volume: "5",
  issue: "1",
  page: "11-12",
  DOI: "10.1038/nphys1170",
};

const BOOK: CslItem = {
  id: "2",
  type: "book",
  title: "Introduction to algorithms",
  author: [
    { family: "Cormen", given: "Thomas H." },
    { family: "Leiserson", given: "Charles E." },
    { family: "Rivest", given: "Ronald L." },
    { family: "Stein", given: "Clifford" },
  ],
  issued: { "date-parts": [[2009]] },
  edition: "3",
  publisher: "MIT Press",
  "publisher-place": "Cambridge, MA",
};

// citeproc is real here, not mocked: these assert what a student would paste.
// Loading it cold takes a few seconds, hence the longer timeout.
describe("formatBibliography", { timeout: 30_000 }, () => {
  it("formats APA 7 references and in-text citations", async () => {
    const entries = await formatBibliography([BOOK, ARTICLE], "apa");

    // Sorted by author, not by the order they were added.
    expect(entries.map((entry) => entry.id)).toEqual(["1", "2"]);
    expect(entries[0].text).toBe(
      "Aspelmeyer, M. (2009). Measured measurement. Nature Physics, 5(1), 11–12. https://doi.org/10.1038/nphys1170",
    );
    expect(entries[0].html).toContain("<i>Nature Physics</i>");
    expect(entries[1].text).toBe(
      "Cormen, T. H., Leiserson, C. E., Rivest, R. L., & Stein, C. (2009). Introduction to algorithms (3rd ed.). MIT Press.",
    );
    expect(entries[1].inText).toBe("(Cormen et al., 2009)");
  });

  it("formats MLA 9 with full given names and no year in text", async () => {
    const [entry] = await formatBibliography([ARTICLE], "mla");
    expect(entry.text).toBe(
      "Aspelmeyer, Markus. “Measured Measurement.” Nature Physics, vol. 5, no. 1, Jan. 2009, pp. 11–12, https://doi.org/10.1038/nphys1170.",
    );
    expect(entry.inText).toBe("(Aspelmeyer)");
  });

  it("formats Chicago author-date and Harvard", async () => {
    const [chicago] = await formatBibliography([BOOK], "chicago");
    expect(chicago.inText).toBe("(Cormen et al. 2009)");
    const [harvard] = await formatBibliography([BOOK], "harvard");
    expect(harvard.text).toBe(
      "Cormen, T.H. et al. (2009) Introduction to algorithms. 3rd ed. Cambridge, MA: MIT Press.",
    );
  });

  it("numbers IEEE in-text citations to match the reference list", async () => {
    const entries = await formatBibliography([ARTICLE, BOOK], "ieee");
    expect(entries.map((entry) => entry.inText)).toEqual(["[1]", "[2]"]);
    expect(entries[1].text.startsWith("[2] T. H. Cormen")).toBe(true);
    // The number column is flattened so the entry pastes as one line.
    expect(entries[1].html.startsWith("[2] T. H. Cormen")).toBe(true);
  });

  it("tells two works by the same author in the same year apart", async () => {
    const second = { ...ARTICLE, id: "3", title: "Another measurement", DOI: undefined };
    const entries = await formatBibliography([ARTICLE, second], "apa");
    expect(entries.map((entry) => entry.inText).sort()).toEqual([
      "(Aspelmeyer, 2009a)",
      "(Aspelmeyer, 2009b)",
    ]);
  });

  it("prints n.d. for a source with no date rather than failing", async () => {
    const [entry] = await formatBibliography(
      [{ id: "4", type: "webpage", title: "Style guide", "container-title": "Example" }],
      "apa",
    );
    expect(entry.text).toContain("(n.d.)");
  });

  it("returns nothing for an empty list without loading the engine", async () => {
    expect(await formatBibliography([], "apa")).toEqual([]);
  });
});

describe("sanitizeCitationHtml", () => {
  it("keeps the formatting a citation uses", () => {
    const html =
      'A <i>B</i> <b>C</b> H<sub>2</sub>O x<sup>2</sup> <span style="font-variant:small-caps;">D</span>';
    expect(sanitizeCitationHtml(html)).toBe(html);
  });

  it("drops everything else, including scripts and handlers", () => {
    expect(sanitizeCitationHtml('<img src=x onerror="alert(1)">Title<script>bad()</script>')).toBe(
      "Titlebad()",
    );
    expect(sanitizeCitationHtml('<a href="javascript:alert(1)">x</a>')).toBe("x");
  });

  it("neutralises a span with an unexpected style but keeps tags balanced", () => {
    expect(sanitizeCitationHtml('<span style="background:url(x)">y</span>')).toBe("<span>y</span>");
  });

  it("escapes a stray angle bracket in text", () => {
    expect(sanitizeCitationHtml("a < b")).toBe("a &lt; b");
  });
});

describe("clipboard output", () => {
  it("adds a hanging indent for styles that use one, and not for IEEE", async () => {
    const apa = await formatBibliography([ARTICLE], "apa");
    expect(bibliographyClipboardHtml(apa, "apa")).toMatch(
      /^<p style="margin:0 0 0 0\.5in;text-indent:-0\.5in;">/,
    );
    const ieee = await formatBibliography([ARTICLE], "ieee");
    expect(bibliographyClipboardHtml(ieee, "ieee")).toMatch(/^<p style="margin:0;">/);
  });

  it("separates plain-text references with a blank line", async () => {
    const entries = await formatBibliography([ARTICLE, BOOK], "apa");
    expect(bibliographyText(entries).split("\n\n")).toHaveLength(2);
  });
});

describe("exportSources", { timeout: 30_000 }, () => {
  it("writes BibTeX that LaTeX can read", async () => {
    const bibtex = await exportSources([BOOK], "bibtex");
    expect(bibtex).toContain("@book{");
    expect(bibtex).toContain(
      "author = {Cormen, Thomas H. and Leiserson, Charles E. and Rivest, Ronald L. and Stein, Clifford}",
    );
    expect(bibtex).toContain("edition = {3}");
  });

  it("writes RIS that reference managers can import", async () => {
    const ris = await exportSources([ARTICLE], "ris");
    expect(ris).toContain("TY  - JOUR");
    expect(ris).toContain("DO  - 10.1038/nphys1170");
    expect(ris.trim().endsWith("ER  -")).toBe(true);
  });
});
