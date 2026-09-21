/**
 * Rendering sources into citations, and exporting them.
 *
 * The formatting itself is citeproc-js, the processor Zotero and Mendeley
 * use, driven through citation-js with the official CSL style definitions.
 * Writing five style formatters by hand would mean re-deriving hundreds of
 * pages of style-guide rules; running the reference implementation means the
 * output matches what a student's supervisor gets from Zotero.
 *
 * All of it is dynamically imported. citeproc is the heaviest code in the
 * app, and nothing about the page needs it until there is a source to format.
 */
import { CITATION_STYLES, getStyle } from "./styles";
import type { CitationStyleId, CslItem } from "./types";

type CitationJs = typeof import("@citation-js/core");

let engine: Promise<CitationJs> | null = null;

/** Loads citation-js and its CSL plugin once, however many callers ask. */
function loadEngine(): Promise<CitationJs> {
  engine ??= Promise.all([import("@citation-js/core"), import("@citation-js/plugin-csl")])
    .then(([core]) => core)
    .catch((error: unknown) => {
      // A failed chunk load (offline, first visit) must be retryable.
      engine = null;
      throw error;
    });
  return engine;
}

const registered = new Set<CitationStyleId>();

async function prepareStyle(styleId: CitationStyleId): Promise<{ core: CitationJs; name: string }> {
  const [core, xml] = await Promise.all([
    loadEngine(),
    registered.has(styleId) ? Promise.resolve(null) : getStyle(styleId).load(),
  ]);
  const name = `toolkit-${styleId}`;
  if (xml !== null) {
    core.plugins.config.get("@csl").styles.add(name, xml);
    registered.add(styleId);
  }
  return { core, name };
}

/**
 * Starts the engine and style downloading before anything needs them, so the
 * first citation appears without a wait and the chunks are in the service
 * worker's cache for the next offline visit.
 */
export function preloadCitationEngine(styleId: CitationStyleId): void {
  void prepareStyle(styleId)
    .then(() =>
      // The other four styles too, once the one in use is ready: switching
      // style on a later offline visit should not need the network.
      Promise.all(CITATION_STYLES.map((style) => style.load())),
    )
    .catch(() => {
      // Offline on a first visit. The next real call reports it.
    });
}

export interface FormattedEntry {
  id: string;
  /** Sanitised HTML: only the inline tags a citation uses. */
  html: string;
  text: string;
  /** The in-text citation, for example "(Cormen et al., 2009)" or "[3]". */
  inText: string;
}

/**
 * Formats a whole reference list, in the order the style prescribes.
 *
 * Every source is registered with the processor at once rather than
 * formatted one by one, because citations depend on each other: two works by
 * the same author in the same year become 2020a and 2020b, and a numeric
 * style's numbers depend on position.
 */
export async function formatBibliography(
  items: readonly CslItem[],
  styleId: CitationStyleId,
): Promise<FormattedEntry[]> {
  if (items.length === 0) return [];

  const { core, name } = await prepareStyle(styleId);
  const cite = new core.Cite(items.map((item) => ({ ...item })));
  const options = { style: name, lang: LOCALE } as const;

  const html = cite.format("bibliography", { ...options, format: "html", asEntryArray: true });
  const text = new Map(
    cite.format("bibliography", { ...options, format: "text", asEntryArray: true }),
  );

  const order = html.map(([id]) => id);
  const inText = inTextCitations(core, cite.data, name, order);

  return html.map(([id, entry], index) => ({
    id,
    html: entryHtml(entry),
    text: (text.get(id) ?? "").trim(),
    inText: inText[index] ?? "",
  }));
}

const LOCALE = "en-US";

/** The slice of citeproc's engine used here; the plugin does not type it. */
interface CiteprocEngine {
  rebuildProcessorState: (
    citations: { citationItems: { id: string }[]; properties: { noteIndex: number } }[],
    format: string,
    uncited: string[],
  ) => [id: string, noteIndex: number, output: string][];
}

/**
 * Every source's in-text citation, from one pass of the processor.
 *
 * Citing each source once, in reference-list order, is what gives a numeric
 * style the same numbers as its list, and registering them all together is
 * what lets an author-date style add the "a" and "b" to two works by the same
 * author in the same year. Formatting them one at a time gets both wrong.
 */
function inTextCitations(
  core: CitationJs,
  data: InstanceType<CitationJs["Cite"]>["data"],
  styleName: string,
  order: string[],
): string[] {
  const engine: CiteprocEngine = core.plugins.config
    .get("@csl")
    .engine(data, styleName, LOCALE, "text");
  const citations = order.map((id) => ({ citationItems: [{ id }], properties: { noteIndex: 0 } }));
  return engine.rebuildProcessorState(citations, "text", []).map(([, , output]) => output);
}

const ALLOWED_TAG = /^<\/?(?:i|b|sup|sub|span)>$/;
const ALLOWED_SPAN_STYLE =
  /^<span style="(?:font-variant:\s?(?:small-caps|normal)|font-style:\s?normal|font-weight:\s?normal|text-decoration:\s?underline);?">$/;

/**
 * Keeps the inline formatting a citation needs — italics, small caps, sub-
 * and superscripts — and drops every other tag.
 *
 * citeproc already escapes the text it is given, so this is a second line of
 * defence rather than the first: metadata fetched from a publisher is
 * rendered as HTML on this page and pasted into Word, and neither should ever
 * carry anything but formatting.
 */
export function sanitizeCitationHtml(html: string): string {
  return html
    .split(/(<[^>]*>)/)
    .map((token) => {
      if (!token.startsWith("<") || !token.endsWith(">")) {
        return token.replace(/</g, "&lt;").replace(/>/g, "&gt;");
      }
      if (ALLOWED_TAG.test(token) || ALLOWED_SPAN_STYLE.test(token)) return token;
      // An opening span with a style we do not allow keeps its place, so the
      // matching close tag still balances.
      if (/^<span\b/i.test(token)) return "<span>";
      return "";
    })
    .join("");
}

/**
 * One entry's inner HTML. Numeric styles lay the number out in its own
 * column; flattening that to "[1] Text" is what every word processor expects
 * when the list is pasted.
 */
function entryHtml(html: string): string {
  const flattened = html.replace(/<\/div>\s*<div class="csl-right-inline">/g, " ");
  return sanitizeCitationHtml(flattened).replace(/\s+/g, " ").trim();
}

/**
 * The reference list as a fragment that pastes into Word or Google Docs with
 * its italics and hanging indent intact. Inline styles, because a pasted
 * document has no stylesheet.
 */
export function bibliographyClipboardHtml(
  entries: readonly FormattedEntry[],
  styleId: CitationStyleId,
): string {
  const indent = getStyle(styleId).hangingIndent
    ? "margin:0 0 0 0.5in;text-indent:-0.5in;"
    : "margin:0;";
  return entries.map((entry) => `<p style="${indent}">${entry.html}</p>`).join("");
}

export function bibliographyText(entries: readonly FormattedEntry[]): string {
  return entries.map((entry) => entry.text).join("\n\n");
}

export type ExportFormat = "bibtex" | "ris";

/**
 * BibTeX for LaTeX and Overleaf, RIS for Zotero, Mendeley and EndNote. The
 * plugins are loaded only when a student actually exports.
 */
export async function exportSources(
  items: readonly CslItem[],
  format: ExportFormat,
): Promise<string> {
  const [core] = await Promise.all([
    loadEngine(),
    format === "bibtex" ? import("@citation-js/plugin-bibtex") : import("@citation-js/plugin-ris"),
  ]);
  const cite = new core.Cite(items.map((item) => ({ ...item })));
  return cite.format(format === "bibtex" ? "bibtex" : "ris", { format: "text" });
}
