import { describe, expect, it } from "vitest";

import {
  isValidIsbn10,
  isValidIsbn13,
  isbn10To13,
  normalizeIsbn,
  parseIdentifier,
} from "./identifiers";

function ok(input: string) {
  const result = parseIdentifier(input);
  if (!result.ok) throw new Error(`expected ${input} to parse, got ${result.reason}`);
  return result.identifier;
}

describe("ISBN check digits", () => {
  it("accepts a valid ISBN-13 and rejects a one-digit typo", () => {
    expect(isValidIsbn13("9780306406157")).toBe(true);
    expect(isValidIsbn13("9780306406158")).toBe(false);
  });

  it("accepts a valid ISBN-10, including an X check digit", () => {
    expect(isValidIsbn10("0306406152")).toBe(true);
    expect(isValidIsbn10("080442957X")).toBe(true);
    expect(isValidIsbn10("0306406153")).toBe(false);
  });

  it("converts ISBN-10 to the matching ISBN-13", () => {
    expect(isbn10To13("0306406152")).toBe("9780306406157");
    expect(isbn10To13("080442957X".slice(0, 9) + "X")).toBe("9780804429573");
  });

  it("normalises hyphens and spaces, and returns null for a bad number", () => {
    expect(normalizeIsbn("978-0-306-40615-7")).toBe("9780306406157");
    expect(normalizeIsbn("0 306 40615 2")).toBe("9780306406157");
    expect(normalizeIsbn("9780306406158")).toBeNull();
  });
});

describe("parseIdentifier", () => {
  it("finds a bare DOI", () => {
    expect(ok("10.1038/nphys1170")).toEqual({ kind: "doi", value: "10.1038/nphys1170" });
  });

  it("strips the resolver from a DOI link and any prefix", () => {
    expect(ok("https://doi.org/10.1038/nphys1170").value).toBe("10.1038/nphys1170");
    expect(ok("doi:10.1038/nphys1170").value).toBe("10.1038/nphys1170");
    expect(ok("DOI: 10.1000/182").value).toBe("10.1000/182");
  });

  it("drops punctuation copied along with a DOI from a sentence", () => {
    expect(ok("(see 10.1038/nphys1170).").value).toBe("10.1038/nphys1170");
  });

  it("keeps parentheses that are part of a DOI", () => {
    expect(ok("10.1016/0021-9991(90)90201-A").value).toBe("10.1016/0021-9991(90)90201-A");
  });

  it("recognises an ISBN-13 with hyphens and a prefix", () => {
    expect(ok("ISBN 978-0-306-40615-7")).toEqual({ kind: "isbn", value: "9780306406157" });
  });

  it("converts an ISBN-10 to ISBN-13", () => {
    expect(ok("0-306-40615-2")).toEqual({ kind: "isbn", value: "9780306406157" });
  });

  it("reports an ISBN with a wrong check digit as invalid, not unknown", () => {
    expect(parseIdentifier("9780306406158")).toEqual({ ok: false, reason: "invalid-isbn" });
  });

  it("recognises new and old arXiv ids, with or without a version", () => {
    expect(ok("arXiv:2101.00001")).toEqual({ kind: "arxiv", value: "2101.00001" });
    expect(ok("2101.00001v3").value).toBe("2101.00001");
    expect(ok("https://arxiv.org/abs/2101.00001v2").value).toBe("2101.00001");
    expect(ok("https://arxiv.org/pdf/2101.00001.pdf").value).toBe("2101.00001");
    expect(ok("hep-th/9901001").value).toBe("hep-th/9901001");
  });

  it("treats an arXiv DOI as an arXiv id", () => {
    expect(ok("10.48550/arXiv.2101.00001")).toEqual({ kind: "arxiv", value: "2101.00001" });
  });

  it("recognises PubMed ids from a prefix, a URL, or a bare number", () => {
    expect(ok("PMID: 31452104")).toEqual({ kind: "pmid", value: "31452104" });
    expect(ok("https://pubmed.ncbi.nlm.nih.gov/31452104/").value).toBe("31452104");
    expect(ok("31452104").value).toBe("31452104");
  });

  it("does not mistake an arXiv URL for a DOI", () => {
    expect(ok("https://arxiv.org/abs/2101.00001").kind).toBe("arxiv");
  });

  it("reports empty and unrecognised input", () => {
    expect(parseIdentifier("   ")).toEqual({ ok: false, reason: "empty" });
    expect(parseIdentifier("the great gatsby")).toEqual({ ok: false, reason: "unrecognised" });
  });
});
