import { describe, expect, it } from "vitest";

import { buildIndex, searchNotes } from "./search";

const notes = [
  { id: 1, title: "Photosynthesis", body: "Light reactions happen in the thylakoid.", tags: [] },
  {
    id: 2,
    title: "Cell respiration",
    body: "Glycolysis, then the Krebs cycle.",
    tags: ["biology"],
  },
  { id: 3, title: "Waves", body: "Photosynthesis is not covered here.", tags: ["physics"] },
];

describe("searchNotes", () => {
  const index = buildIndex(notes);

  it("ranks a title match above a body match", () => {
    expect(searchNotes(index, "photosynthesis")).toEqual([1, 3]);
  });

  it("matches while the word is still being typed", () => {
    expect(searchNotes(index, "thylak")).toEqual([1]);
  });

  it("forgives a small typo in a longer word", () => {
    expect(searchNotes(index, "glycolisis")).toEqual([2]);
  });

  it("searches tags, and needs every word to match", () => {
    expect(searchNotes(index, "biology")).toEqual([2]);
    expect(searchNotes(index, "krebs waves")).toEqual([]);
  });

  it("returns nothing for an empty query", () => {
    expect(searchNotes(index, "  ")).toEqual([]);
  });
});
