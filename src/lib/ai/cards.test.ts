import { describe, expect, it } from "vitest";

import { parseGeneratedCards } from "./cards";

describe("parseGeneratedCards", () => {
  it("reads the JSON array the model is asked for", () => {
    expect(
      parseGeneratedCards('[{"front":"What is ATP?","back":"The cell\'s energy currency"}]'),
    ).toEqual([{ front: "What is ATP?", back: "The cell's energy currency" }]);
  });

  it("digs the array out of code fences and chatter", () => {
    const reply =
      'Here are your cards:\n\n```json\n[{"front":"A","back":"B"}]\n```\n\nHappy studying!';
    expect(parseGeneratedCards(reply)).toEqual([{ front: "A", back: "B" }]);
  });

  it("accepts question/answer and term/definition keys", () => {
    expect(
      parseGeneratedCards('[{"question":"Q1","answer":"A1"},{"term":"T","definition":"D"}]'),
    ).toEqual([
      { front: "Q1", back: "A1" },
      { front: "T", back: "D" },
    ]);
  });

  it("falls back to dashed lines, tidying list markers", () => {
    const reply =
      "1. **Mitosis** — division into two identical cells\n2. Meiosis — four haploid cells";
    expect(parseGeneratedCards(reply)).toEqual([
      { front: "Mitosis", back: "division into two identical cells" },
      { front: "Meiosis", back: "four haploid cells" },
    ]);
  });

  it("does not turn ordinary prose into cards", () => {
    expect(parseGeneratedCards("Photosynthesis is how plants make food.")).toEqual([]);
    expect(parseGeneratedCards("One line — with a dash in it")).toEqual([]);
    expect(parseGeneratedCards("[]")).toEqual([]);
  });

  it("skips entries that are missing a side", () => {
    expect(parseGeneratedCards('[{"front":"only"},{"front":"a","back":"b"}]')).toEqual([
      { front: "a", back: "b" },
    ]);
  });
});
