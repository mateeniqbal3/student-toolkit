/**
 * The editable form of a source, and the conversions to and from CSL-JSON.
 *
 * The form keeps every field it has ever been given, even ones the current
 * source type does not show, so a student who picks "Book" by mistake and
 * switches back to "Journal article" has not lost the journal name. Only when
 * the draft becomes a stored source are the fields narrowed to the type.
 */
import { makeDate } from "./normalize";
import type { CslDate, CslItem, CslItemType, CslName } from "./types";

export const TEXT_FIELDS = [
  "title",
  "container-title",
  "volume",
  "issue",
  "page",
  "edition",
  "publisher",
  "publisher-place",
  "genre",
  "number",
  "DOI",
  "ISBN",
  "URL",
] as const;

export type TextField = (typeof TEXT_FIELDS)[number];

export interface SourceTypeDefinition {
  type: CslItemType;
  label: string;
  /** In the order the form shows them. The title is always first and always shown. */
  fields: TextField[];
  /** Field labels that differ for this type: a "container" is a journal, a book or a website. */
  labels: Partial<Record<TextField, string>>;
  editors: boolean;
  /** Web sources are cited with the date they were read, because they change. */
  accessed: boolean;
}

export const FIELD_LABELS: Record<TextField, string> = {
  title: "Title",
  "container-title": "Published in",
  volume: "Volume",
  issue: "Issue",
  page: "Pages",
  edition: "Edition",
  publisher: "Publisher",
  "publisher-place": "Place of publication",
  genre: "Type",
  number: "Number",
  DOI: "DOI",
  ISBN: "ISBN",
  URL: "URL",
};

export const FIELD_HINTS: Partial<Record<TextField, string>> = {
  page: "For example 45-67",
  edition: "A number, such as 3 for a third edition",
  DOI: "For example 10.1038/nphys1170",
};

export const SOURCE_TYPES: readonly SourceTypeDefinition[] = [
  {
    type: "article-journal",
    label: "Journal article",
    fields: ["title", "container-title", "volume", "issue", "page", "DOI", "URL"],
    labels: { title: "Article title", "container-title": "Journal" },
    editors: false,
    accessed: false,
  },
  {
    type: "book",
    label: "Book",
    fields: ["title", "edition", "publisher", "publisher-place", "ISBN", "DOI", "URL"],
    labels: { title: "Book title" },
    editors: false,
    accessed: false,
  },
  {
    type: "chapter",
    label: "Book chapter",
    fields: [
      "title",
      "container-title",
      "page",
      "edition",
      "publisher",
      "publisher-place",
      "ISBN",
      "DOI",
    ],
    labels: { title: "Chapter title", "container-title": "Book title" },
    editors: true,
    accessed: false,
  },
  {
    type: "webpage",
    label: "Web page",
    fields: ["title", "container-title", "URL"],
    labels: { title: "Page title", "container-title": "Website name" },
    editors: false,
    accessed: true,
  },
  {
    type: "paper-conference",
    label: "Conference paper",
    fields: ["title", "container-title", "page", "publisher", "publisher-place", "DOI", "URL"],
    labels: { title: "Paper title", "container-title": "Proceedings or conference name" },
    editors: false,
    accessed: false,
  },
  {
    type: "article",
    label: "Preprint",
    fields: ["title", "publisher", "number", "DOI", "URL"],
    labels: { publisher: "Repository", number: "Identifier" },
    editors: false,
    accessed: false,
  },
  {
    type: "report",
    label: "Report",
    fields: ["title", "publisher", "number", "genre", "publisher-place", "DOI", "URL"],
    labels: { publisher: "Organisation", number: "Report number", genre: "Report type" },
    editors: false,
    accessed: false,
  },
  {
    type: "thesis",
    label: "Thesis",
    fields: ["title", "genre", "publisher", "publisher-place", "URL"],
    labels: { publisher: "University", genre: "Thesis type" },
    editors: false,
    accessed: false,
  },
];

export function getSourceType(type: CslItemType): SourceTypeDefinition {
  return SOURCE_TYPES.find((definition) => definition.type === type) ?? SOURCE_TYPES[0];
}

export function fieldLabel(definition: SourceTypeDefinition, field: TextField): string {
  return definition.labels[field] ?? FIELD_LABELS[field];
}

export interface NameDraft {
  /** Stable React key, never stored. */
  key: string;
  kind: "person" | "organisation";
  given: string;
  family: string;
  /** The organisation's name, when kind is "organisation". */
  literal: string;
}

export interface DateDraft {
  year: string;
  /** "1" to "12", or "" for no month. */
  month: string;
  day: string;
}

export interface SourceDraft {
  type: CslItemType;
  text: Record<TextField, string>;
  authors: NameDraft[];
  editors: NameDraft[];
  issued: DateDraft;
  accessed: DateDraft;
}

export function blankName(kind: NameDraft["kind"] = "person"): NameDraft {
  return { key: crypto.randomUUID(), kind, given: "", family: "", literal: "" };
}

const EMPTY_DATE: DateDraft = { year: "", month: "", day: "" };

export function todayDraft(now = new Date()): DateDraft {
  return {
    year: String(now.getFullYear()),
    month: String(now.getMonth() + 1),
    day: String(now.getDate()),
  };
}

export function emptyDraft(type: CslItemType = "article-journal", now = new Date()): SourceDraft {
  const text = Object.fromEntries(TEXT_FIELDS.map((field) => [field, ""])) as Record<
    TextField,
    string
  >;
  return {
    type,
    text,
    authors: [blankName()],
    editors: [],
    issued: { ...EMPTY_DATE },
    accessed: todayDraft(now),
  };
}

function nameToDraft(name: CslName): NameDraft {
  if (name.literal !== undefined && name.family === undefined) {
    return { ...blankName("organisation"), literal: name.literal };
  }
  const family = name.suffix ? `${name.family ?? ""}, ${name.suffix}` : (name.family ?? "");
  return { ...blankName("person"), given: name.given ?? "", family };
}

function dateToDraft(date: CslDate | undefined): DateDraft {
  const [year, month, day] = date?.["date-parts"][0] ?? [];
  return {
    year: year === undefined ? "" : String(year),
    month: month === undefined ? "" : String(month),
    day: day === undefined ? "" : String(day),
  };
}

export function draftFromItem(item: CslItem, now = new Date()): SourceDraft {
  const draft = emptyDraft(item.type, now);
  for (const field of TEXT_FIELDS) draft.text[field] = item[field] ?? "";
  draft.authors = item.author?.length ? item.author.map(nameToDraft) : [blankName()];
  draft.editors = item.editor?.map(nameToDraft) ?? [];
  draft.issued = dateToDraft(item.issued);
  if (item.accessed) draft.accessed = dateToDraft(item.accessed);
  return draft;
}

function draftToName(draft: NameDraft): CslName | null {
  if (draft.kind === "organisation") {
    const literal = draft.literal.trim();
    return literal ? { literal } : null;
  }

  const given = draft.given.trim();
  // "King, Jr" in the family box is how a suffix is typed.
  const [familyPart, suffix] = draft.family.split(/,\s*(?=(?:jr|sr|ii|iii|iv)\.?$)/i);
  const family = familyPart.trim();
  if (!family && !given) return null;
  // A single name ("Plato") is a family name as far as every style is concerned.
  if (!family) return { family: given };

  const name: CslName = { family };
  if (given) name.given = given;
  if (suffix) name.suffix = suffix.trim();
  return name;
}

function draftToDate(draft: DateDraft): CslDate | undefined {
  const year = Number(draft.year);
  if (!draft.year.trim() || !Number.isInteger(year)) return undefined;
  return makeDate(
    year,
    draft.month ? Number(draft.month) : undefined,
    draft.day ? Number(draft.day) : undefined,
  );
}

export type DraftProblem = "missing-title" | "bad-year";

/** What stops a draft being saved. Everything else a style can print around. */
export function draftProblems(draft: SourceDraft): DraftProblem[] {
  const problems: DraftProblem[] = [];
  if (!draft.text.title.trim()) problems.push("missing-title");
  if (draft.issued.year.trim() && !draftToDate(draft.issued)) problems.push("bad-year");
  return problems;
}

/**
 * Builds the stored source, keeping only the fields the chosen type shows.
 * Empty fields are left out rather than stored as "", because a style tests
 * whether a variable exists, and an empty one would print its punctuation.
 */
export function itemFromDraft(draft: SourceDraft, id: string): CslItem {
  const definition = getSourceType(draft.type);
  const item: CslItem = { id, type: draft.type, title: draft.text.title.trim() };

  for (const field of definition.fields) {
    if (field === "title") continue;
    const value = draft.text[field].trim();
    if (value) item[field] = value;
  }

  const author = draft.authors.map(draftToName).filter((name): name is CslName => name !== null);
  if (author.length > 0) item.author = author;

  if (definition.editors) {
    const editor = draft.editors.map(draftToName).filter((name): name is CslName => name !== null);
    if (editor.length > 0) item.editor = editor;
  }

  const issued = draftToDate(draft.issued);
  if (issued) item.issued = issued;

  if (definition.accessed) {
    const accessed = draftToDate(draft.accessed);
    if (accessed) item.accessed = accessed;
  }

  return item;
}
