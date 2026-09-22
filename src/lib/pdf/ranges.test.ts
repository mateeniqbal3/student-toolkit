import { describe, expect, it } from "vitest";

import { everyNPages, formatRange, parsePageRanges, rangeIndexes } from "./ranges";

describe("parsePageRanges", () => {
  it("reads single pages, ranges and open ends, keeping order", () => {
    expect(parsePageRanges("5, 1-3, 8-, -2", 10)).toEqual({
      ok: true,
      ranges: [
        { from: 5, to: 5 },
        { from: 1, to: 3 },
        { from: 8, to: 10 },
        { from: 1, to: 2 },
      ],
    });
  });

  it("forgives spaces, en dashes and semicolons", () => {
    expect(parsePageRanges(" 2 – 4 ; 6 ", 6)).toEqual({
      ok: true,
      ranges: [
        { from: 2, to: 4 },
        { from: 6, to: 6 },
      ],
    });
  });

  it("names the part that is wrong", () => {
    expect(parsePageRanges("", 5)).toEqual({ ok: false, error: { kind: "empty" } });
    expect(parsePageRanges("1, two", 5)).toEqual({
      ok: false,
      error: { kind: "invalid", token: "two" },
    });
    expect(parsePageRanges("-", 5)).toEqual({ ok: false, error: { kind: "invalid", token: "-" } });
    expect(parsePageRanges("4-9", 5)).toEqual({
      ok: false,
      error: { kind: "out-of-range", token: "4-9", pageCount: 5 },
    });
    expect(parsePageRanges("0", 5)).toMatchObject({ ok: false, error: { kind: "out-of-range" } });
    expect(parsePageRanges("4-2", 5)).toEqual({
      ok: false,
      error: { kind: "backwards", token: "4-2" },
    });
  });
});

describe("range helpers", () => {
  it("turns ranges into 0-based indexes", () => {
    expect(
      rangeIndexes([
        { from: 3, to: 4 },
        { from: 1, to: 1 },
      ]),
    ).toEqual([2, 3, 0]);
  });

  it("chunks a document every N pages, with a short last chunk", () => {
    expect(everyNPages(10, 4).map(formatRange)).toEqual(["1-4", "5-8", "9-10"]);
    expect(everyNPages(3, 0).map(formatRange)).toEqual(["1", "2", "3"]);
  });
});
