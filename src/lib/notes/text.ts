/**
 * Plain-text views of a note, for the list. Deliberately regex-light rather
 * than a Markdown parse: the list must stay cheap, and the parser is only
 * loaded when a note is previewed.
 */

/** A note's display title, falling back to its first line of text. */
export function displayTitle(title: string, body: string): string {
  const trimmed = title.trim();
  if (trimmed) return trimmed;
  const firstLine = markdownToText(body)
    .split("\n")
    .find((line) => line.trim());
  return firstLine?.trim().slice(0, 80) ?? "";
}

/** Markdown with the syntax taken out, roughly as it reads rendered. */
export function markdownToText(markdown: string): string {
  return markdown
    .replace(/^```.*$/gm, "")
    .replace(/\$\$([\s\S]*?)\$\$/g, "$1")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+[.)])\s+/gm, "")
    .replace(/(\*\*|__|\*|_|~~|`)/g, "")
    .replace(/[ \t]+/g, " ");
}

/**
 * The first stretch of text after the title, for the list preview. A note
 * that opens with its own title as a heading does not repeat it.
 */
export function snippet(body: string, length = 140, title = ""): string {
  const lines = markdownToText(body).split("\n");
  const first = lines.findIndex((line) => line.trim());
  if (first !== -1 && title.trim() && lines[first]?.trim() === title.trim()) {
    lines.splice(first, 1);
  }
  const text = lines.join(" ").replace(/\s+/g, " ").trim();
  return text.length > length ? `${text.slice(0, length - 1).trimEnd()}…` : text;
}

export function wordCount(body: string): number {
  const text = markdownToText(body).trim();
  return text ? text.split(/\s+/).length : 0;
}
