import { describe, expect, it } from "vitest";

import { parseMedlineName, splitDisplayName } from "./names";

describe("splitDisplayName", () => {
  it("splits on the last word and keeps middle initials with the given name", () => {
    expect(splitDisplayName("Thomas H. Cormen")).toEqual({ family: "Cormen", given: "Thomas H." });
  });

  it("keeps lower-case particles with the family name", () => {
    expect(splitDisplayName("Ludwig van Beethoven")).toEqual({
      family: "van Beethoven",
      given: "Ludwig",
    });
    expect(splitDisplayName("Walter Filgueira de Azevedo")).toEqual({
      family: "de Azevedo",
      given: "Walter Filgueira",
    });
  });

  it("reads a suffix off the end", () => {
    expect(splitDisplayName("Martin Luther King Jr.")).toEqual({
      family: "King",
      given: "Martin Luther",
      suffix: "Jr",
    });
  });

  it("accepts the catalogue ordering, family name first", () => {
    expect(splitDisplayName("Austen, Jane")).toEqual({ family: "Austen", given: "Jane" });
  });

  it("treats a single name as a family name", () => {
    expect(splitDisplayName("Aristotle")).toEqual({ family: "Aristotle" });
    expect(splitDisplayName("   ")).toBeNull();
  });
});

describe("parseMedlineName", () => {
  it("expands run-together initials", () => {
    expect(parseMedlineName("Bitencourt-Ferreira G")).toEqual({
      family: "Bitencourt-Ferreira",
      given: "G.",
    });
    expect(parseMedlineName("de Azevedo WF Jr")).toEqual({
      family: "de Azevedo",
      given: "W. F.",
      suffix: "Jr",
    });
  });

  it("keeps a collective author whole", () => {
    expect(parseMedlineName("COVID-19 Genomics Consortium")).toEqual({
      literal: "COVID-19 Genomics Consortium",
    });
  });
});
