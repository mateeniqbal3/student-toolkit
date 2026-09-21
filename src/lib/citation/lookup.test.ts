import { describe, expect, it } from "vitest";

import { lookupIdentifier, mapPubmedSummary } from "./lookup";

type Route = [pattern: RegExp, respond: () => Response | Promise<Response>];

/** A fetch that answers from a table and records every request it was given. */
function fakeFetch(routes: Route[]) {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    const route = routes.find(([pattern]) => pattern.test(url));
    if (!route) throw new TypeError(`offline: ${url}`);
    return route[1]();
  }) as typeof fetch;
  return { impl, calls };
}

const json =
  (body: unknown, status = 200) =>
  () =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const notFound = () => new Response("", { status: 404 });

const CROSSREF_CSL = {
  type: "journal-article",
  title: "Measured measurement",
  author: [{ given: "Markus", family: "Aspelmeyer", sequence: "first", affiliation: [] }],
  issued: { "date-parts": [[2009, 1]] },
  "container-title": "Nature Physics",
  volume: "5",
  issue: "1",
  page: "11-12",
  DOI: "10.1038/nphys1170",
  URL: "http://dx.doi.org/10.1038/nphys1170",
};

describe("DOI lookup", () => {
  it("asks doi.org for CSL-JSON and sends nothing but the DOI", async () => {
    const { impl, calls } = fakeFetch([[/^https:\/\/doi\.org\//, json(CROSSREF_CSL)]]);
    const result = await lookupIdentifier(
      { kind: "doi", value: "10.1038/nphys1170" },
      { fetchImpl: impl },
    );

    expect(result).toMatchObject({
      ok: true,
      source: "doi.org",
      item: { type: "article-journal", title: "Measured measurement", DOI: "10.1038/nphys1170" },
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://doi.org/10.1038/nphys1170");
    expect(new Headers(calls[0].init?.headers).get("accept")).toBe(
      "application/vnd.citationstyles.csl+json",
    );
    expect(calls[0].init?.body).toBeUndefined();
    expect(calls[0].init?.method).toBeUndefined();
  });

  it("falls back to the Crossref API when doi.org cannot be reached", async () => {
    const { impl } = fakeFetch([
      [
        /api\.crossref\.org/,
        json({ status: "ok", message: { ...CROSSREF_CSL, title: ["Measured measurement"] } }),
      ],
    ]);
    const result = await lookupIdentifier(
      { kind: "doi", value: "10.1038/nphys1170" },
      { fetchImpl: impl },
    );
    expect(result).toMatchObject({ ok: true, source: "Crossref" });
  });

  it("escapes characters in a DOI that mean something in a URL", async () => {
    const { impl, calls } = fakeFetch([]);
    await lookupIdentifier({ kind: "doi", value: "10.1000/a#b?c" }, { fetchImpl: impl });
    expect(calls[0].url).toBe("https://doi.org/10.1000/a%23b%3Fc");
  });

  it("reports not found when a service answers that it has no such DOI", async () => {
    const { impl } = fakeFetch([
      [/doi\.org/, notFound],
      [/api\.crossref\.org/, notFound],
    ]);
    const result = await lookupIdentifier(
      { kind: "doi", value: "10.9999/nope" },
      { fetchImpl: impl },
    );
    expect(result).toEqual({ ok: false, reason: "not-found" });
  });

  it("reports unreachable, not missing, when nothing answers at all", async () => {
    const { impl } = fakeFetch([]);
    const result = await lookupIdentifier({ kind: "doi", value: "10.1038/x" }, { fetchImpl: impl });
    expect(result).toEqual({ ok: false, reason: "unreachable" });
  });

  it("treats a rate limit as unreachable rather than not found", async () => {
    const { impl } = fakeFetch([[/./, () => new Response("", { status: 429 })]]);
    const result = await lookupIdentifier({ kind: "doi", value: "10.1038/x" }, { fetchImpl: impl });
    expect(result).toEqual({ ok: false, reason: "unreachable" });
  });
});

describe("arXiv lookup", () => {
  it("goes through the paper's DataCite DOI and records it as a preprint", async () => {
    const { impl, calls } = fakeFetch([
      [
        /doi\.org/,
        json({
          type: "article-journal",
          title: "Heterotic string junctions",
          author: [{ family: "Imamura", given: "Yosuke" }],
          issued: { "date-parts": [[1999]] },
          "container-title": "arXiv",
          DOI: "10.48550/ARXIV.HEP-TH/9901001",
          publisher: "arXiv",
        }),
      ],
    ]);
    const result = await lookupIdentifier(
      { kind: "arxiv", value: "hep-th/9901001" },
      { fetchImpl: impl },
    );

    expect(calls[0].url).toBe("https://doi.org/10.48550/arXiv.hep-th/9901001");
    expect(result.ok && result.item).toMatchObject({
      type: "article",
      publisher: "arXiv",
      number: "arXiv:hep-th/9901001",
    });
    expect(result.ok && result.item["container-title"]).toBeUndefined();
  });
});

describe("ISBN lookup", () => {
  it("takes the edition details from the edition and the authors from the search index", async () => {
    const { impl } = fakeFetch([
      [
        /openlibrary\.org\/isbn\//,
        json({
          title: "Introduction to Algorithms",
          publishers: ["The MIT Press"],
          publish_places: ["Cambridge, MA, USA"],
          publish_date: "2009",
          edition_name: "Third Edition",
        }),
      ],
      [
        /openlibrary\.org\/search\.json/,
        json({ docs: [{ author_name: ["Thomas H. Cormen", "Charles E. Leiserson"] }] }),
      ],
    ]);
    const result = await lookupIdentifier(
      { kind: "isbn", value: "9780262033848" },
      { fetchImpl: impl },
    );

    expect(result).toMatchObject({
      ok: true,
      source: "Open Library",
      item: {
        type: "book",
        title: "Introduction to Algorithms",
        author: [
          { family: "Cormen", given: "Thomas H." },
          { family: "Leiserson", given: "Charles E." },
        ],
        publisher: "The MIT Press",
        "publisher-place": "Cambridge, MA, USA",
        issued: { "date-parts": [[2009]] },
        edition: "3",
        ISBN: "9780262033848",
      },
    });
  });

  it("still returns the book when the author search fails", async () => {
    const { impl } = fakeFetch([
      [/openlibrary\.org\/isbn\//, json({ title: "Pride and Prejudice", publish_date: "2003" })],
    ]);
    const result = await lookupIdentifier(
      { kind: "isbn", value: "9780141439518" },
      { fetchImpl: impl },
    );
    expect(result.ok && result.item.author).toBeUndefined();
    expect(result.ok && result.item.title).toBe("Pride and Prejudice");
  });

  it("tries Google Books when Open Library has no record", async () => {
    const { impl } = fakeFetch([
      [/openlibrary\.org/, notFound],
      [
        /googleapis\.com/,
        json({
          totalItems: 1,
          items: [
            {
              volumeInfo: {
                title: "Pride and Prejudice",
                authors: ["Jane Austen"],
                publisher: "Penguin",
                publishedDate: "2003-01-30",
              },
            },
          ],
        }),
      ],
    ]);
    const result = await lookupIdentifier(
      { kind: "isbn", value: "9780141439518" },
      { fetchImpl: impl },
    );
    expect(result).toMatchObject({
      ok: true,
      source: "Google Books",
      item: { author: [{ family: "Austen", given: "Jane" }], issued: { "date-parts": [[2003]] } },
    });
  });
});

const PUBMED_SUMMARY = {
  uid: "31452104",
  pubdate: "2019 Mar 15",
  source: "Methods Mol Biol",
  authors: [
    { name: "Bitencourt-Ferreira G", authtype: "Author" },
    { name: "de Azevedo WF Jr", authtype: "Author" },
  ],
  title: "Molegro Virtual Docker for Docking.",
  fulljournalname: "Methods in molecular biology (Clifton, N.J.)",
  volume: "2053",
  issue: "",
  pages: "149-167",
  articleids: [
    { idtype: "pubmed", value: "31452104" },
    { idtype: "doi", value: "10.1007/978-1-4939-9752-7_10" },
  ],
  booktitle: "",
};

describe("PubMed lookup", () => {
  it("maps the summary, including MEDLINE-style names and dates", () => {
    expect(mapPubmedSummary("31452104", PUBMED_SUMMARY)).toMatchObject({
      type: "article-journal",
      title: "Molegro Virtual Docker for Docking",
      author: [
        { family: "Bitencourt-Ferreira", given: "G." },
        { family: "de Azevedo", given: "W. F.", suffix: "Jr" },
      ],
      "container-title": "Methods in molecular biology",
      issued: { "date-parts": [[2019, 3, 15]] },
      volume: "2053",
      page: "149-167",
      PMID: "31452104",
      DOI: "10.1007/978-1-4939-9752-7_10",
    });
  });

  it("prefers the publisher's record through the DOI, keeping the PubMed id", async () => {
    const { impl, calls } = fakeFetch([
      [/eutils\.ncbi\.nlm\.nih\.gov/, json({ result: { "31452104": PUBMED_SUMMARY } })],
      [
        /doi\.org/,
        json({
          type: "book-chapter",
          title: "Molegro Virtual Docker for Docking",
          author: [{ family: "Bitencourt-Ferreira", given: "Gabriela" }],
          DOI: "10.1007/978-1-4939-9752-7_10",
        }),
      ],
    ]);
    const result = await lookupIdentifier({ kind: "pmid", value: "31452104" }, { fetchImpl: impl });

    expect(calls.map((call) => new URL(call.url).hostname)).toEqual([
      "eutils.ncbi.nlm.nih.gov",
      "doi.org",
    ]);
    expect(result).toMatchObject({
      ok: true,
      item: {
        type: "chapter",
        author: [{ family: "Bitencourt-Ferreira", given: "Gabriela" }],
        PMID: "31452104",
      },
    });
  });

  it("falls back to the summary when the DOI lookup fails", async () => {
    const { impl } = fakeFetch([
      [/eutils\.ncbi\.nlm\.nih\.gov/, json({ result: { "31452104": PUBMED_SUMMARY } })],
    ]);
    const result = await lookupIdentifier({ kind: "pmid", value: "31452104" }, { fetchImpl: impl });
    expect(result.ok && result.item.author?.[0]).toEqual({
      family: "Bitencourt-Ferreira",
      given: "G.",
    });
  });

  it("reports an unknown id as not found", async () => {
    const { impl } = fakeFetch([
      [
        /eutils\.ncbi\.nlm\.nih\.gov/,
        json({
          result: {
            uids: [],
            "99999999": { uid: "99999999", error: "cannot get document summary" },
          },
        }),
      ],
    ]);
    const result = await lookupIdentifier({ kind: "pmid", value: "99999999" }, { fetchImpl: impl });
    expect(result).toEqual({ ok: false, reason: "not-found" });
  });
});
