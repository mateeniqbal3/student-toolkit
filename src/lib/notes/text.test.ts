import { describe, expect, it } from "vitest";

import { displayTitle, snippet, wordCount } from "./text";

describe("plain-text views", () => {
  it("strips Markdown syntax for the list preview", () => {
    expect(snippet("# Heading\n\n- **bold** and _em_ with [a link](https://x.org)\n> quote")).toBe(
      "Heading bold and em with a link quote",
    );
  });

  it("does not repeat a title the note opens with", () => {
    expect(snippet("# Waves\n\nNodes and antinodes.", 140, "Waves")).toBe("Nodes and antinodes.");
    expect(snippet("# Other\n\nText", 140, "Waves")).toBe("Other Text");
  });

  it("shortens long previews with an ellipsis", () => {
    expect(snippet("word ".repeat(100), 20)).toBe("word word word word…");
  });

  it("falls back to the first line when there is no title", () => {
    expect(displayTitle("  ", "\n\n## Kinematics\nv = u + at")).toBe("Kinematics");
    expect(displayTitle("Given", "body")).toBe("Given");
    expect(displayTitle("", "")).toBe("");
  });

  it("counts words, not syntax", () => {
    expect(wordCount("# Two words")).toBe(2);
    expect(wordCount("")).toBe(0);
  });
});
