import { describe, expect, it } from "vitest";

import { descendantIds, folderPath, folderRows, wouldCycle } from "./folders";

const folders = [
  { id: 1, name: "Year 2", parentId: null },
  { id: 2, name: "biology", parentId: 1 },
  { id: 3, name: "Genetics", parentId: 2 },
  { id: 4, name: "Art", parentId: null },
  { id: 5, name: "Anatomy", parentId: 1 },
];

describe("folderRows", () => {
  it("lists depth first with siblings alphabetical, ignoring case", () => {
    expect(folderRows(folders).map((row) => [row.folder.name, row.depth])).toEqual([
      ["Art", 0],
      ["Year 2", 0],
      ["Anatomy", 1],
      ["biology", 1],
      ["Genetics", 2],
    ]);
  });

  it("keeps folders whose parent is missing, and survives a cycle", () => {
    const broken = [
      { id: 1, name: "Orphan", parentId: 99 },
      { id: 2, name: "Loop A", parentId: 3 },
      { id: 3, name: "Loop B", parentId: 2 },
    ];
    expect(
      folderRows(broken)
        .map((row) => row.folder.id)
        .sort(),
    ).toEqual([1, 2, 3]);
  });
});

describe("folder relationships", () => {
  it("finds everything nested inside a folder", () => {
    expect([...descendantIds(folders, 1)].sort()).toEqual([1, 2, 3, 5]);
  });

  it("refuses to move a folder inside itself", () => {
    expect(wouldCycle(folders, 1, 3)).toBe(true);
    expect(wouldCycle(folders, 1, 1)).toBe(true);
    expect(wouldCycle(folders, 3, 4)).toBe(false);
    expect(wouldCycle(folders, 3, null)).toBe(false);
  });

  it("gives a folder's full path", () => {
    expect(folderPath(folders, 3)).toEqual(["Year 2", "biology", "Genetics"]);
    expect(folderPath(folders, null)).toEqual([]);
  });
});
