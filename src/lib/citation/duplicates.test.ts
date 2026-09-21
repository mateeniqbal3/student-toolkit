import { describe, expect, it } from "vitest";

import { findDuplicate, isSameSource } from "./duplicates";
import type { CslItem } from "./types";

const base: CslItem = { id: "1", type: "article-journal", title: "Measured measurement" };

describe("isSameSource", () => {
  it("matches DOIs regardless of case", () => {
    expect(
      isSameSource(
        { ...base, DOI: "10.48550/ARXIV.2101.00001" },
        { ...base, id: "2", DOI: "10.48550/arXiv.2101.00001" },
      ),
    ).toBe(true);
  });

  it("trusts differing identifiers over a matching title", () => {
    expect(isSameSource({ ...base, DOI: "10.1/a" }, { ...base, id: "2", DOI: "10.1/b" })).toBe(
      false,
    );
  });

  it("matches a hand-typed copy by title and year, ignoring case and punctuation", () => {
    const typed: CslItem = {
      ...base,
      id: "2",
      title: "Measured Measurement.",
      issued: { "date-parts": [[2009]] },
    };
    expect(isSameSource({ ...base, issued: { "date-parts": [[2009, 1]] } }, typed)).toBe(true);
    expect(isSameSource({ ...base, issued: { "date-parts": [[2010]] } }, typed)).toBe(false);
  });
});

describe("findDuplicate", () => {
  it("does not report a source as a duplicate of itself", () => {
    const records = [{ item: base }];
    expect(findDuplicate(records, base)).toBeUndefined();
    expect(findDuplicate(records, { ...base, id: "9" })).toBe(records[0]);
  });
});
