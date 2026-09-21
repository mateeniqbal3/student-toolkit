import { describe, expect, it } from "vitest";

import { cleanText, normalizeCslItem, normalizeEdition, readDate } from "./normalize";

const options = { id: "x", fallbackType: "article" } as const;

describe("normalizeCslItem", () => {
  it("keeps the fields a citation needs and drops the rest", () => {
    const item = normalizeCslItem(
      {
        type: "journal-article",
        title: "Measured measurement",
        author: [
          {
            given: "Markus",
            family: "Aspelmeyer",
            sequence: "first",
            affiliation: [],
          },
        ],
        issued: { "date-parts": [[2009, 1]] },
        "container-title": "Nature Physics",
        volume: "5",
        issue: "1",
        page: "11-12",
        DOI: "10.1038/nphys1170",
        URL: "http://dx.doi.org/10.1038/nphys1170",
        license: [{ URL: "http://www.springer.com/tdm" }],
        "reference-count": 10,
      },
      options,
    );

    expect(item).toEqual({
      id: "x",
      type: "article-journal",
      title: "Measured measurement",
      author: [{ family: "Aspelmeyer", given: "Markus" }],
      issued: { "date-parts": [[2009, 1]] },
      "container-title": "Nature Physics",
      volume: "5",
      issue: "1",
      page: "11-12",
      DOI: "10.1038/nphys1170",
    });
  });

  it("reads Crossref's array-valued titles", () => {
    const item = normalizeCslItem(
      { title: ["Measured measurement"], "container-title": ["Nature Physics"] },
      options,
    );
    expect(item?.title).toBe("Measured measurement");
    expect(item?.["container-title"]).toBe("Nature Physics");
  });

  it("maps organisation authors to literal names", () => {
    const item = normalizeCslItem(
      { title: "Report", author: [{ name: "World Health Organization" }] },
      options,
    );
    expect(item?.author).toEqual([{ literal: "World Health Organization" }]);
  });

  it("falls back to the print date when there is no issued date", () => {
    const item = normalizeCslItem(
      { title: "T", "published-print": { "date-parts": [[2020, 3, 4]] } },
      options,
    );
    expect(item?.issued).toEqual({ "date-parts": [[2020, 3, 4]] });
  });

  it("refuses a record with no title", () => {
    expect(normalizeCslItem({ author: [{ family: "A" }] }, options)).toBeNull();
    expect(normalizeCslItem("not an object", options)).toBeNull();
  });

  it("uses the fallback type for a type it does not know", () => {
    expect(normalizeCslItem({ title: "T", type: "dataset" }, options)?.type).toBe("article");
  });

  it("writes arXiv DOIs in their conventional casing", () => {
    expect(normalizeCslItem({ title: "T", DOI: "10.48550/ARXIV.2101.00001" }, options)?.DOI).toBe(
      "10.48550/arXiv.2101.00001",
    );
  });
});

describe("cleanText", () => {
  it("turns JATS markup into the tags a style understands and drops the rest", () => {
    expect(cleanText("The <jats:italic>E. coli</jats:italic> genome")).toBe(
      "The <i>E. coli</i> genome",
    );
    expect(
      cleanText('<jats:title>CO<jats:sub>2</jats:sub></jats:title> <a href="x">link</a>'),
    ).toBe("CO<sub>2</sub> link");
  });

  it("collapses the whitespace publishers leave in titles", () => {
    expect(cleanText("  A\n   title  ")).toBe("A title");
  });
});

describe("readDate", () => {
  it("rejects impossible parts rather than storing them", () => {
    expect(readDate({ "date-parts": [[2020, 13]] })).toEqual({ "date-parts": [[2020]] });
    expect(readDate({ "date-parts": [[null]] })).toBeUndefined();
  });

  it("finds a year in a raw date", () => {
    expect(readDate({ raw: "c1998, reprinted 2004" })).toEqual({ "date-parts": [[1998]] });
  });
});

describe("normalizeEdition", () => {
  it("reduces numbered editions to the number a style expects", () => {
    expect(normalizeEdition("Third Edition")).toBe("3");
    expect(normalizeEdition("3rd ed.")).toBe("3");
    expect(normalizeEdition("2")).toBe("2");
  });

  it("keeps an edition that is not a number", () => {
    expect(normalizeEdition("Revised")).toBe("Revised");
  });
});
