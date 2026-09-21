/**
 * Getting cards in and out as plain text.
 *
 * The format is delimited text, because it is what everything else speaks:
 * Anki exports "Notes in Plain Text" as tab-separated values and imports the
 * same, Quizlet exports tab- or comma-separated pairs, and any spreadsheet can
 * write CSV. Nothing is uploaded — files are read and written in the browser.
 */

export type Delimiter = "\t" | ";" | ",";

export interface CardText {
  front: string;
  back: string;
}

const HEADER_SEPARATORS: Record<string, Delimiter> = {
  tab: "\t",
  semicolon: ";",
  comma: ",",
};

/**
 * Anki writes `#separator:tab` and similar header lines; honour them. Failing
 * that, a tab anywhere is decisive (nobody types tabs into a card), then
 * whichever of semicolon or comma appears on more lines.
 */
export function detectDelimiter(text: string): Delimiter {
  const header = /^#separator:(\w+)\s*$/im.exec(text);
  if (header) {
    const named = HEADER_SEPARATORS[header[1].toLowerCase()];
    if (named) return named;
  }

  const lines = text.split(/\r?\n/).filter((line) => line.trim() && !line.startsWith("#"));
  if (lines.some((line) => line.includes("\t"))) return "\t";
  const semicolons = lines.filter((line) => line.includes(";")).length;
  const commas = lines.filter((line) => line.includes(",")).length;
  return semicolons > commas ? ";" : ",";
}

/**
 * RFC 4180 parsing: fields may be quoted, quotes inside are doubled, and a
 * quoted field may contain the delimiter or a line break.
 */
export function parseDelimited(text: string, delimiter: Delimiter): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"' && field === "") {
      quoted = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};

/**
 * Anki fields are HTML. Line breaks are kept as line breaks; any other markup
 * is dropped, because cards here are plain text.
 */
export function fromAnkiHtml(value: string): string {
  if (!/[<&]/.test(value)) return value.trim();
  return (
    value
      .replace(/<br\s*\/?>/gi, "\n")
      // Anki's editor starts each new line with an opening <div>.
      .replace(/<(div|p|li)\b[^>]*>/gi, "\n")
      .replace(/<[^>]*>/g, "")
      .replace(/&(nbsp|amp|lt|gt|quot|#39);/g, (entity) => ENTITIES[entity] ?? entity)
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

export interface ImportResult {
  cards: CardText[];
  /** Rows that did not have both a front and a back. */
  skipped: number;
  delimiter: Delimiter;
}

export function parseCards(text: string, delimiter = detectDelimiter(text)): ImportResult {
  // Header lines only come first, so a card whose text starts with # is kept.
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  let firstContent = 0;
  while (firstContent < lines.length && lines[firstContent].startsWith("#")) firstContent += 1;
  const body = lines.slice(firstContent).join("\n");

  const cards: CardText[] = [];
  let skipped = 0;
  for (const row of parseDelimited(body, delimiter)) {
    if (row.every((field) => !field.trim())) continue;
    const front = fromAnkiHtml(row[0] ?? "");
    const back = fromAnkiHtml(row[1] ?? "");
    if (front && back) cards.push({ front, back });
    else skipped += 1;
  }
  return { cards, skipped, delimiter };
}

function quote(field: string, delimiter: Delimiter): string {
  return field.includes(delimiter) || /["\r\n]/.test(field)
    ? `"${field.replace(/"/g, '""')}"`
    : field;
}

/**
 * Writes cards as delimited text. The tab-separated form starts with Anki's
 * header lines, so Anki picks the right separator and does not read the
 * text as HTML.
 */
export function exportCards(cards: readonly CardText[], delimiter: Delimiter): string {
  const header = delimiter === "\t" ? "#separator:tab\n#html:false\n" : "";
  const rows = cards.map(
    (card) => `${quote(card.front, delimiter)}${delimiter}${quote(card.back, delimiter)}`,
  );
  return `${header}${rows.join("\n")}\n`;
}
