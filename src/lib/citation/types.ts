/**
 * The subset of CSL-JSON this tool reads and writes.
 *
 * CSL-JSON is the interchange format every citation processor understands, so
 * storing it directly means a saved source can be rendered in any style, and
 * exported to BibTeX or RIS, without a translation layer of our own.
 */

export type CslItemType =
  | "article-journal"
  | "book"
  | "chapter"
  | "paper-conference"
  | "webpage"
  | "article"
  | "report"
  | "thesis";

export interface CslName {
  family?: string;
  given?: string;
  /** "Jr", "III". */
  suffix?: string;
  /** For organisations, which have no family or given name. */
  literal?: string;
}

export interface CslDate {
  /** One entry of year, month, day — each part after the year is optional. */
  "date-parts": [[number, number?, number?]];
}

export interface CslItem {
  id: string;
  type: CslItemType;
  title?: string;
  author?: CslName[];
  editor?: CslName[];
  issued?: CslDate;
  accessed?: CslDate;
  "container-title"?: string;
  volume?: string;
  issue?: string;
  page?: string;
  edition?: string;
  publisher?: string;
  "publisher-place"?: string;
  DOI?: string;
  ISBN?: string;
  URL?: string;
  PMID?: string;
  number?: string;
  /** The kind of a thesis or report: "Doctoral dissertation", "Technical report". */
  genre?: string;
}

/** The kinds of public identifier a student can paste to auto-fill a source. */
export type IdentifierKind = "doi" | "isbn" | "arxiv" | "pmid";

export interface ParsedIdentifier {
  kind: IdentifierKind;
  /** Normalised: DOIs without a resolver prefix, ISBNs as 13 bare digits. */
  value: string;
}

export const CITATION_STYLE_IDS = ["apa", "mla", "chicago", "ieee", "harvard"] as const;
export type CitationStyleId = (typeof CITATION_STYLE_IDS)[number];
