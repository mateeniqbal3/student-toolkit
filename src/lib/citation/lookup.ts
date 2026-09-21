/**
 * Filling in a source from a public identifier.
 *
 * This is one of the three places the app reaches the network, so what it
 * sends is worth stating exactly: the DOI, ISBN, arXiv or PubMed id the
 * student pasted, and nothing else. No cookie, no account, no identifier of
 * the student, and none of the other sources in their bibliography. The
 * identifier is public, and so is everything that comes back.
 *
 * Every service used here is free, needs no key and allows requests straight
 * from a browser, which is what lets this work without a server of our own.
 * Each kind of identifier has a fallback service, because a project with no
 * budget cannot pay for an uptime guarantee. When everything fails, the
 * student can still type the source in by hand.
 */
import { parseMedlineName, splitDisplayName } from "./names";
import {
  asRecord,
  makeDate,
  normalizeCslItem,
  normalizeEdition,
  readString,
  yearFromText,
} from "./normalize";
import type { CslItem, CslName, IdentifierKind, ParsedIdentifier } from "./types";

export interface LookupOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export type LookupResult =
  | { ok: true; item: CslItem; source: string }
  /**
   * `not-found`: a service answered and has no record of that identifier.
   * `unreachable`: no service answered at all, which usually means offline.
   */
  | { ok: false; reason: "not-found" | "unreachable" };

/** Thrown for anything other than a clean "no such record". */
class LookupError extends Error {}

const CSL_JSON = "application/vnd.citationstyles.csl+json";

/**
 * Fetches JSON, returning null for a definite "not found" and throwing for
 * everything else — offline, timed out, rate limited, or a response that is
 * not JSON — so the caller can tell a missing record from a missing network.
 */
async function getJson(url: string, accept: string, options: LookupOptions): Promise<unknown> {
  const { signal, timeoutMs = 10_000, fetchImpl = fetch } = options;
  const timeout = AbortSignal.timeout(timeoutMs);

  const response = await fetchImpl(url, {
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    headers: { accept },
  });
  if (response.status === 404 || response.status === 410) return null;
  if (!response.ok) throw new LookupError(`${url} answered ${response.status}`);
  return response.json();
}

interface Provider {
  label: string;
  /** Resolves to null when the service has no record; throws when it could not be asked. */
  find: (value: string, options: LookupOptions) => Promise<CslItem | null>;
}

function newId(): string {
  return crypto.randomUUID();
}

/** DOIs may contain characters that mean something in a URL; the slashes do not need escaping. */
function doiPath(doi: string): string {
  return doi.split("/").map(encodeURIComponent).join("/");
}

async function doiContentNegotiation(doi: string, options: LookupOptions) {
  const body = await getJson(`https://doi.org/${doiPath(doi)}`, CSL_JSON, options);
  return body === null ? null : normalizeCslItem(body, { id: newId(), fallbackType: "article" });
}

const DOI_PROVIDERS: Provider[] = [
  {
    // doi.org answers for every registration agency — Crossref for journals,
    // DataCite for datasets and preprints, mEDRA and others — in CSL-JSON.
    label: "doi.org",
    find: doiContentNegotiation,
  },
  {
    label: "Crossref",
    find: async (doi, options) => {
      const body = await getJson(
        `https://api.crossref.org/works/${encodeURIComponent(doi)}`,
        "application/json",
        options,
      );
      if (body === null) return null;
      return normalizeCslItem(asRecord(body)?.message, { id: newId(), fallbackType: "article" });
    },
  },
];

/**
 * arXiv's own API does not allow requests from a browser, but every arXiv
 * paper also has a DataCite DOI, which does.
 */
function arxivDoi(id: string): string {
  return `10.48550/arXiv.${id}`;
}

function asPreprint(item: CslItem | null, id: string): CslItem | null {
  if (!item) return null;
  const preprint: CslItem = { ...item, type: "article", publisher: "arXiv", number: `arXiv:${id}` };
  if (/^arxiv$/i.test(preprint["container-title"] ?? "")) delete preprint["container-title"];
  return preprint;
}

const ARXIV_PROVIDERS: Provider[] = [
  {
    label: "doi.org",
    find: async (id, options) => asPreprint(await doiContentNegotiation(arxivDoi(id), options), id),
  },
  {
    label: "DataCite",
    find: async (id, options) => {
      const body = await getJson(
        `https://api.datacite.org/dois/${encodeURIComponent(CSL_JSON)}/${doiPath(arxivDoi(id))}`,
        CSL_JSON,
        options,
      );
      if (body === null) return null;
      return asPreprint(normalizeCslItem(body, { id: newId(), fallbackType: "article" }), id);
    },
  },
];

function namesFrom(values: unknown, parse: (name: string) => CslName | null): CslName[] {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => (typeof value === "string" ? parse(value) : null))
    .filter((name): name is CslName => name !== null);
}

function joinTitle(title: string | undefined, subtitle: string | undefined): string | undefined {
  if (!title) return undefined;
  return subtitle ? `${title}: ${subtitle}` : title;
}

const ISBN_PROVIDERS: Provider[] = [
  {
    // The edition record is exact — this printing's publisher, year and
    // edition — but often has no authors, so the author names come from the
    // search index, which records them for the work as a whole.
    label: "Open Library",
    find: async (isbn, options) => {
      const [edition, search] = await Promise.all([
        getJson(`https://openlibrary.org/isbn/${isbn}.json`, "application/json", options),
        getJson(
          `https://openlibrary.org/search.json?isbn=${isbn}&fields=author_name`,
          "application/json",
          options,
        ).catch(() => null),
      ]);

      const record = asRecord(edition);
      const title = joinTitle(readString(record?.title), readString(record?.subtitle));
      if (!record || !title) return null;

      const docs = asRecord(search)?.docs;
      const work = asRecord(Array.isArray(docs) ? docs[0] : null);
      const item: CslItem = { id: newId(), type: "book", title, ISBN: isbn };

      const author = namesFrom(work?.author_name, splitDisplayName);
      if (author.length > 0) item.author = author;
      const publisher = readString(record.publishers);
      if (publisher) item.publisher = publisher;
      const place = readString(record.publish_places);
      if (place) item["publisher-place"] = place;
      const issued = yearFromText(readString(record.publish_date) ?? "");
      if (issued) item.issued = issued;
      const editionNumber = normalizeEdition(readString(record.edition_name));
      if (editionNumber) item.edition = editionNumber;

      return item;
    },
  },
  {
    label: "Google Books",
    find: async (isbn, options) => {
      const body = asRecord(
        await getJson(
          `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`,
          "application/json",
          options,
        ),
      );
      const items = body?.items;
      const volume = asRecord(asRecord(Array.isArray(items) ? items[0] : null)?.volumeInfo);
      const title = joinTitle(readString(volume?.title), readString(volume?.subtitle));
      if (!volume || !title) return null;

      const item: CslItem = { id: newId(), type: "book", title, ISBN: isbn };
      const author = namesFrom(volume.authors, splitDisplayName);
      if (author.length > 0) item.author = author;
      const publisher = readString(volume.publisher);
      if (publisher) item.publisher = publisher;
      const issued = yearFromText(readString(volume.publishedDate) ?? "");
      if (issued) item.issued = issued;
      return item;
    },
  },
];

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** PubMed dates look like "2019", "2019 Mar" or "2019 Mar 15". */
function pubmedDate(value: string | undefined) {
  const match = /^(\d{4})(?:\s+([A-Za-z]{3}))?(?:\s+(\d{1,2}))?/.exec(value ?? "");
  if (!match) return undefined;
  const month = match[2] ? MONTHS.indexOf(match[2].toLowerCase()) + 1 : undefined;
  return makeDate(Number(match[1]), month || undefined, match[3] ? Number(match[3]) : undefined);
}

/** "Methods in molecular biology (Clifton, N.J.)" — the place is NLM's, not the journal's. */
function journalName(value: string | undefined): string | undefined {
  return value?.replace(/\s*\([^)]*\)\s*$/, "").trim() || undefined;
}

/** Maps an E-utilities summary record. Exported for its tests. */
export function mapPubmedSummary(pmid: string, value: unknown): CslItem | null {
  const record = asRecord(value);
  if (!record || record.error) return null;

  const title = readString(record.title)?.replace(/\.$/, "");
  if (!title) return null;

  const bookTitle = readString(record.booktitle);
  const item: CslItem = {
    id: newId(),
    type: bookTitle ? "chapter" : "article-journal",
    title,
    PMID: pmid,
  };

  const authors = Array.isArray(record.authors) ? record.authors : [];
  const author = authors
    .map(asRecord)
    .filter((entry) => entry && (entry.authtype === "Author" || entry.authtype === undefined))
    .map((entry) => (typeof entry?.name === "string" ? parseMedlineName(entry.name) : null))
    .filter((name): name is CslName => name !== null);
  if (author.length > 0) item.author = author;

  const container =
    bookTitle ?? journalName(readString(record.fulljournalname)) ?? readString(record.source);
  if (container) item["container-title"] = container;
  const issued = pubmedDate(readString(record.pubdate));
  if (issued) item.issued = issued;

  for (const [from, to] of [
    ["volume", "volume"],
    ["issue", "issue"],
    ["pages", "page"],
  ] as const) {
    const text = readString(record[from]);
    if (text) item[to] = text;
  }

  const ids = Array.isArray(record.articleids) ? record.articleids : [];
  const doi = ids
    .map(asRecord)
    .find((entry) => entry?.idtype === "doi" && typeof entry.value === "string")?.value;
  if (typeof doi === "string") item.DOI = doi;

  return item;
}

const PUBMED_PROVIDERS: Provider[] = [
  {
    // PubMed's summary abbreviates given names to initials. When the paper has
    // a DOI, its publisher record has them in full, so that is preferred and
    // the summary is the fallback.
    label: "PubMed",
    find: async (pmid, options) => {
      const body = asRecord(
        await getJson(
          `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=${pmid}`,
          "application/json",
          options,
        ),
      );
      const summary = mapPubmedSummary(pmid, asRecord(body?.result)?.[pmid]);
      if (!summary?.DOI) return summary;

      const full = await doiContentNegotiation(summary.DOI, options).catch(() => null);
      return full ? { ...full, PMID: pmid } : summary;
    },
  },
];

const PROVIDERS: Record<IdentifierKind, Provider[]> = {
  doi: DOI_PROVIDERS,
  arxiv: ARXIV_PROVIDERS,
  isbn: ISBN_PROVIDERS,
  pmid: PUBMED_PROVIDERS,
};

/**
 * Tries each service for the identifier's kind until one has the record.
 *
 * One service saying "no such record" while another cannot be reached still
 * counts as not found: that is the more useful thing to tell a student who
 * has probably mistyped the number.
 */
export async function lookupIdentifier(
  identifier: ParsedIdentifier,
  options: LookupOptions = {},
): Promise<LookupResult> {
  let answered = false;

  for (const provider of PROVIDERS[identifier.kind]) {
    try {
      const item = await provider.find(identifier.value, options);
      if (item) return { ok: true, item, source: provider.label };
      answered = true;
    } catch {
      // Offline, blocked, timed out or rate limited. Try the next one.
    }
  }

  return { ok: false, reason: answered ? "not-found" : "unreachable" };
}
