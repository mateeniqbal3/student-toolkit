import { describe, expect, it } from "vitest";

import { detectDelimiter, exportCards, fromAnkiHtml, parseCards, parseDelimited } from "./transfer";

describe("detectDelimiter", () => {
  it("honours Anki's separator header", () => {
    expect(detectDelimiter("#separator:semicolon\na;b")).toBe(";");
    expect(detectDelimiter("#separator:tab\na\tb")).toBe("\t");
  });

  it("treats any tab as decisive, then prefers whichever of ; and , is commoner", () => {
    expect(detectDelimiter("cell, membrane\tthe boundary")).toBe("\t");
    expect(detectDelimiter("a;b\nc;d, e")).toBe(";");
    expect(detectDelimiter("a,b\nc,d")).toBe(",");
  });
});

describe("parseDelimited", () => {
  it("handles quotes, doubled quotes, delimiters and line breaks inside fields", () => {
    const text = 'front,back\n"a, b","say ""hi""\nthen leave"\r\nlast,row';
    expect(parseDelimited(text, ",")).toEqual([
      ["front", "back"],
      ["a, b", 'say "hi"\nthen leave'],
      ["last", "row"],
    ]);
  });
});

describe("fromAnkiHtml", () => {
  it("keeps line breaks and drops other markup", () => {
    expect(fromAnkiHtml("<b>Mitosis</b><br>cell division<div>two&nbsp;cells</div>")).toBe(
      "Mitosis\ncell division\ntwo cells",
    );
    expect(fromAnkiHtml("a &lt; b &amp;&amp; c")).toBe("a < b && c");
  });
});

describe("parseCards", () => {
  it("reads an Anki plain-text export, skipping its header lines", () => {
    const anki =
      "#separator:tab\n#html:true\nWhat is ATP?\tThe cell's energy currency\n#hashtag\tkept\n";
    const result = parseCards(anki);
    expect(result.cards).toEqual([
      { front: "What is ATP?", back: "The cell's energy currency" },
      { front: "#hashtag", back: "kept" },
    ]);
    expect(result.skipped).toBe(0);
  });

  it("counts rows without both sides as skipped, and ignores blank lines", () => {
    const result = parseCards("a,1\n\nonly a front\n,only a back\nb,2");
    expect(result.cards).toHaveLength(2);
    expect(result.skipped).toBe(2);
  });

  it("ignores a byte-order mark from spreadsheet exports", () => {
    expect(parseCards("﻿a,1").cards).toEqual([{ front: "a", back: "1" }]);
  });
});

describe("exportCards", () => {
  const cards = [
    { front: "Newton's 2nd law", back: "F = ma" },
    { front: "Quote, with comma", back: 'Says "hello"\nand goodbye' },
  ];

  it("writes TSV with Anki's headers, and round-trips", () => {
    const tsv = exportCards(cards, "\t");
    expect(tsv.startsWith("#separator:tab\n#html:false\n")).toBe(true);
    expect(parseCards(tsv).cards).toEqual(cards);
  });

  it("quotes CSV fields that need it, and round-trips", () => {
    const csv = exportCards(cards, ",");
    expect(csv).toContain('"Quote, with comma"');
    expect(parseCards(csv).cards).toEqual(cards);
  });
});
