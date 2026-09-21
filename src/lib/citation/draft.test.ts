import { describe, expect, it } from "vitest";

import { draftFromItem, draftProblems, emptyDraft, itemFromDraft } from "./draft";
import type { CslItem } from "./types";

const NOW = new Date(2026, 8, 21);

const CHAPTER: CslItem = {
  id: "7",
  type: "chapter",
  title: "Docking",
  author: [
    { family: "King", given: "Martin Luther", suffix: "Jr" },
    { literal: "World Health Organization" },
  ],
  editor: [{ family: "Azevedo", given: "Walter" }],
  issued: { "date-parts": [[2019, 3]] },
  "container-title": "Docking screens",
  page: "149-167",
  publisher: "Humana",
};

describe("drafts", () => {
  it("round-trips a stored source without losing anything", () => {
    expect(itemFromDraft(draftFromItem(CHAPTER, NOW), "7")).toEqual(CHAPTER);
  });

  it("keeps only the fields the chosen type shows", () => {
    const draft = draftFromItem(CHAPTER, NOW);
    const asWebpage = itemFromDraft({ ...draft, type: "webpage" }, "7");

    expect(asWebpage.editor).toBeUndefined();
    expect(asWebpage.page).toBeUndefined();
    expect(asWebpage.publisher).toBeUndefined();
    expect(asWebpage["container-title"]).toBe("Docking screens");
    // A web page is cited with the date it was read, defaulting to today.
    expect(asWebpage.accessed).toEqual({ "date-parts": [[2026, 9, 21]] });
  });

  it("keeps hidden fields in the draft, so switching type back loses nothing", () => {
    const switched = { ...draftFromItem(CHAPTER, NOW), type: "webpage" as const };
    const back = itemFromDraft({ ...switched, type: "chapter" }, "7");
    expect(back.page).toBe("149-167");
  });

  it("leaves blank fields and blank names out entirely", () => {
    const draft = emptyDraft("book", NOW);
    draft.text.title = "  A title  ";
    draft.text.publisher = "   ";
    expect(itemFromDraft(draft, "1")).toEqual({ id: "1", type: "book", title: "A title" });
  });

  it("treats a lone first name as a family name", () => {
    const draft = emptyDraft("book", NOW);
    draft.text.title = "Republic";
    draft.authors[0].given = "Plato";
    expect(itemFromDraft(draft, "1").author).toEqual([{ family: "Plato" }]);
  });

  it("reports a missing title and an unreadable year", () => {
    const draft = emptyDraft("book", NOW);
    draft.issued.year = "twenty";
    expect(draftProblems(draft)).toEqual(["missing-title", "bad-year"]);
    draft.text.title = "T";
    draft.issued.year = "";
    expect(draftProblems(draft)).toEqual([]);
  });
});
