import { describe, expect, it } from "vitest";

import {
  createBackup,
  markdownToNote,
  noteFingerprint,
  noteToMarkdown,
  parseBackup,
} from "./transfer";

const CREATED = Date.UTC(2026, 8, 20, 9, 0);
const UPDATED = Date.UTC(2026, 8, 22, 18, 30);

describe("Markdown files", () => {
  const note = {
    title: 'Ohm\'s law: "V = IR"',
    body: "Voltage equals current times resistance.",
    tags: ["physics", "exam-prep"],
    createdAt: CREATED,
    updatedAt: UPDATED,
  };

  it("writes front matter other apps can read", () => {
    expect(noteToMarkdown(note, ["Year 2", "Physics"])).toBe(
      [
        "---",
        'title: "Ohm\'s law: \\"V = IR\\""',
        'tags: ["physics", "exam-prep"]',
        'folder: "Year 2/Physics"',
        "created: 2026-09-20T09:00:00.000Z",
        "updated: 2026-09-22T18:30:00.000Z",
        "---",
        "",
        "Voltage equals current times resistance.",
        "",
      ].join("\n"),
    );
  });

  it("round-trips a note through its own export", () => {
    expect(markdownToNote("x.md", noteToMarkdown(note, []))).toEqual({
      ...note,
      body: `${note.body}\n`,
    });
  });

  it("reads block-list tags and Windows line endings from other apps", () => {
    const text =
      "---\r\ntitle: Genetics\r\ntags:\r\n  - Biology\r\n  - '#Exam Prep'\r\n---\r\nBody";
    expect(markdownToNote("g.md", text)).toMatchObject({
      title: "Genetics",
      tags: ["biology", "exam-prep"],
      body: "Body",
    });
  });

  it("takes the title from the first heading, then the file name", () => {
    expect(markdownToNote("a.md", "Intro\n\n# Real title\n").title).toBe("Real title");
    expect(markdownToNote("lecture 4.md", "no heading").title).toBe("lecture 4");
  });
});

describe("noteFingerprint", () => {
  it("treats the same title and text as the same note, whenever it was made", () => {
    expect(noteFingerprint({ title: "A ", body: "text\n" })).toBe(
      noteFingerprint({ title: "A", body: "text" }),
    );
    expect(noteFingerprint({ title: "A", body: "text" })).not.toBe(
      noteFingerprint({ title: "A", body: "other" }),
    );
  });
});

describe("backups", () => {
  const folders = [
    { id: 7, name: "Physics", parentId: null },
    { id: 8, name: "Waves", parentId: 7 },
  ];
  const notes = [
    {
      title: "Standing waves",
      body: "Nodes and antinodes.",
      tags: ["physics"],
      folderId: 8,
      pinned: true,
      createdAt: CREATED,
      updatedAt: UPDATED,
    },
  ];

  it("round-trips folders and notes", () => {
    const result = parseBackup(createBackup(folders, notes, UPDATED), 0);
    expect(result).toEqual({ ok: true, folders, notes, skipped: 0 });
  });

  it("explains what is wrong with a file that is not a backup", () => {
    expect(parseBackup("{", 0)).toEqual({ ok: false, reason: "not-json" });
    expect(parseBackup('{"format":"other"}', 0)).toEqual({ ok: false, reason: "not-a-backup" });
    expect(parseBackup('{"format":"student-toolkit-notes","version":99}', 0)).toEqual({
      ok: false,
      reason: "newer-version",
    });
  });

  it("skips notes it cannot read and repairs what it can", () => {
    const text = JSON.stringify({
      format: "student-toolkit-notes",
      version: 1,
      folders: [{ id: 1, name: "  " }, { name: "no id" }],
      notes: [{ title: 5 }, { body: "kept", tags: ["#A", 3, "a"], createdAt: "yesterday" }],
    });
    expect(parseBackup(text, 1234)).toEqual({
      ok: true,
      folders: [],
      notes: [
        {
          title: "",
          body: "kept",
          tags: ["a"],
          folderId: null,
          pinned: false,
          createdAt: 1234,
          updatedAt: 1234,
        },
      ],
      skipped: 1,
    });
  });
});
