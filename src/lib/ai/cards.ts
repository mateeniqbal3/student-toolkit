/**
 * Turning a generated reply into flashcards for the flashcards tool.
 *
 * The model is asked for a JSON array, and usually sends one. Models also
 * wrap JSON in code fences, add a sentence before it, or fall back to
 * "Front - Back" lines, so all of those are read rather than refused.
 */
import type { CardText } from "@/lib/flashcards/transfer";

function clean(value: string): string {
  return (
    value
      .replace(/\\n/g, "\n")
      .trim()
      // The list marker first, then the bold wrapper: "1. **Mitosis**" is both.
      .replace(/^(?:[*+-]\s+|\d+[.)]\s+)/, "")
      .replace(/^\*\*([\s\S]*)\*\*$/, "$1")
      .trim()
  );
}

function fromJson(text: string): CardText[] {
  // The outermost array in the reply, fences and chatter either side ignored.
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end <= start) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const cards: CardText[] = [];
  for (const item of parsed) {
    if (typeof item !== "object" || item === null) continue;
    const record = item as Record<string, unknown>;
    const front = record.front ?? record.question ?? record.term;
    const back = record.back ?? record.answer ?? record.definition;
    if (typeof front === "string" && typeof back === "string" && front.trim() && back.trim()) {
      cards.push({ front: clean(front), back: clean(back) });
    }
  }
  return cards;
}

/** "Front — Back" lines, the shape a model falls back to when it ignores the JSON. */
function fromLines(text: string): CardText[] {
  const cards: CardText[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("```")) continue;
    const match = /^(.{3,}?)\s+(?:[—–|]|::|\s-\s)\s*(.+)$/.exec(trimmed);
    if (!match) continue;
    const front = clean(match[1] ?? "");
    const back = clean(match[2] ?? "");
    if (front && back) cards.push({ front, back });
  }
  return cards;
}

/** The cards in a reply, or an empty list if it does not look like cards at all. */
export function parseGeneratedCards(reply: string): CardText[] {
  const fromJsonArray = fromJson(reply);
  if (fromJsonArray.length > 0) return fromJsonArray;
  const lines = fromLines(reply);
  // One stray dashed line in a prose answer is not a set of flashcards.
  return lines.length >= 2 ? lines : [];
}
