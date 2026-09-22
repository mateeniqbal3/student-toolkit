import { describe, expect, it } from "vitest";

import { renderMarkdown } from "./markdown";

describe("renderMarkdown", () => {
  it("renders ordinary Markdown and code blocks", () => {
    const html = renderMarkdown("# Title\n\n**bold**\n\n```\nconst x = 1;\n```");
    expect(html).toContain("<h1>Title</h1>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<pre><code>const x = 1;\n</code></pre>");
  });

  it("renders inline and display maths with KaTeX", () => {
    const html = renderMarkdown("Energy $E = mc^2$\n\n$$\n\\int_0^1 x\\,dx\n$$");
    expect(html).toContain('class="katex"');
    expect(html).toContain("katex-display");
  });

  it("leaves prices alone", () => {
    expect(renderMarkdown("It costs $5 and $10.")).not.toContain("katex");
  });

  it("shows raw HTML as text rather than running it", () => {
    const html = renderMarkdown('<script>alert(1)</script><img src=x onerror="alert(1)">');
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
  });

  it("refuses script links, and opens others in a new tab", () => {
    expect(renderMarkdown("[x](javascript:alert(1))")).not.toContain("href");
    expect(renderMarkdown("[site](https://example.org)")).toContain(
      '<a href="https://example.org" target="_blank" rel="noopener noreferrer nofollow">site</a>',
    );
  });

  it("does not load remote images", () => {
    const html = renderMarkdown("![diagram](https://tracker.example/pixel.png)");
    expect(html).not.toContain("<img");
    expect(html).toContain('href="https://tracker.example/pixel.png"');
  });

  it("does not let maths produce links or load images", () => {
    const html = renderMarkdown(
      "$\\href{javascript:alert(1)}{x}$ $\\includegraphics{https://x.org/a.png}$",
    );
    // The source appears as escaped text in KaTeX's error rendering; what
    // matters is that no link or image element is produced from it.
    expect(html).not.toContain("href=");
    expect(html).not.toContain("<a ");
    expect(html).not.toContain("<img");
  });
});
