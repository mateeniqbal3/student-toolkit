import { describe, expect, it } from "vitest";

import { countTags, normaliseTag, parseTags } from "./tags";

describe("tags", () => {
  it("normalises spelling, hashes and spaces", () => {
    expect(normaliseTag("  #Exam Prep ")).toBe("exam-prep");
    expect(normaliseTag("##")).toBeNull();
    expect(normaliseTag("-")).toBeNull();
  });

  it("reads comma lists, or hashtags and words without commas", () => {
    expect(parseTags("Biology, exam prep, biology")).toEqual(["biology", "exam-prep"]);
    expect(parseTags("#physics #waves")).toEqual(["physics", "waves"]);
    expect(parseTags("   ")).toEqual([]);
  });

  it("counts tags, most used first", () => {
    const notes = [{ tags: ["b", "a"] }, { tags: ["a"] }, { tags: ["c"] }];
    expect(countTags(notes)).toEqual([
      { tag: "a", count: 2 },
      { tag: "b", count: 1 },
      { tag: "c", count: 1 },
    ]);
  });
});
