"use client";

import { Loader2, PenLine, Plus, Search, X } from "lucide-react";
import { useMemo, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseIdentifier } from "@/lib/citation/identifiers";
import { lookupIdentifier } from "@/lib/citation/lookup";
import type { CitationStyleId, CslItem, IdentifierKind } from "@/lib/citation/types";

import { useFormattedBibliography } from "./use-formatted-bibliography";

const KIND_NAMES: Record<IdentifierKind, string> = {
  doi: "DOI",
  isbn: "ISBN",
  arxiv: "arXiv ID",
  pmid: "PubMed ID",
};

type FinderState =
  | { status: "idle" }
  | { status: "searching" }
  | { status: "found"; item: CslItem; source: string; duplicate: boolean }
  | { status: "error"; message: string };

/**
 * Paste an identifier, get a source. The student sees the formatted result
 * before it is added, because metadata from publishers is sometimes wrong and
 * the moment to notice is before it is in the reference list.
 */
export function SourceFinder({
  style,
  onAdd,
  onEdit,
  onManual,
}: {
  style: CitationStyleId;
  /** Resolves false, without adding, when the source is already in the list and `force` is not set. */
  onAdd: (item: CslItem, force: boolean) => Promise<boolean>;
  onEdit: (item: CslItem) => void;
  onManual: () => void;
}) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<FinderState>({ status: "idle" });
  const controller = useRef<AbortController | null>(null);

  async function search(event: FormEvent) {
    event.preventDefault();
    const parsed = parseIdentifier(query);

    if (!parsed.ok) {
      setState({
        status: "error",
        message:
          parsed.reason === "empty"
            ? "Paste a DOI, ISBN, arXiv ID or PubMed ID first."
            : parsed.reason === "invalid-isbn"
              ? "That ISBN’s check digit does not match, so there is probably a typo in it."
              : "That does not look like a DOI, ISBN, arXiv ID or PubMed ID. You can type the source in by hand instead.",
      });
      return;
    }

    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setState({ status: "searching" });

    const result = await lookupIdentifier(parsed.identifier, { signal: current.signal });
    if (current.signal.aborted) return;

    const kind = KIND_NAMES[parsed.identifier.kind];
    setState(
      result.ok
        ? { status: "found", item: result.item, source: result.source, duplicate: false }
        : {
            status: "error",
            message:
              result.reason === "not-found"
                ? `Nothing is registered under that ${kind}. Check it for a typo, or type the source in by hand.`
                : `Could not reach the lookup services, so you may be offline. Your saved sources still work, and you can type this one in by hand.`,
          },
    );
  }

  async function add(item: CslItem, force: boolean) {
    const added = await onAdd(item, force);
    if (added) {
      setState({ status: "idle" });
      setQuery("");
    } else if (state.status === "found") {
      setState({ ...state, duplicate: true });
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <form className="flex flex-col gap-2" onSubmit={(event) => void search(event)}>
        <Label htmlFor="source-identifier" className="font-display font-semibold">
          Find a source
        </Label>
        <div className="flex gap-2">
          <Input
            id="source-identifier"
            className="h-10 min-w-0 flex-1"
            placeholder="DOI, ISBN, arXiv or PubMed ID"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="search"
            value={query}
            aria-describedby="finder-privacy"
            onChange={(event) => setQuery(event.target.value)}
          />
          <Button type="submit" className="h-10 shrink-0" disabled={state.status === "searching"}>
            {state.status === "searching" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Search className="size-4" aria-hidden />
            )}
            Find
          </Button>
        </div>
        <p id="finder-privacy" className="text-muted-foreground text-xs text-pretty">
          Only the identifier is sent — to doi.org, Crossref, Open Library or PubMed — and nothing
          else about you or your bibliography.
        </p>
      </form>

      <div aria-live="polite" className="flex flex-col gap-3">
        {state.status === "searching" ? <span className="sr-only">Looking it up</span> : null}

        {state.status === "error" ? (
          <p role="status" className="text-muted-foreground text-sm text-pretty">
            {state.message}
          </p>
        ) : null}

        {state.status === "found" ? (
          <FoundSource
            item={state.item}
            source={state.source}
            style={style}
            duplicate={state.duplicate}
            onAdd={(force) => void add(state.item, force)}
            onEdit={() => {
              onEdit(state.item);
              setState({ status: "idle" });
              setQuery("");
            }}
            onDismiss={() => setState({ status: "idle" })}
          />
        ) : null}
      </div>

      <Button variant="outline" className="w-fit" onClick={onManual}>
        <PenLine className="size-4" aria-hidden />
        Type a source in by hand
      </Button>
    </div>
  );
}

function FoundSource({
  item,
  source,
  style,
  duplicate,
  onAdd,
  onEdit,
  onDismiss,
}: {
  item: CslItem;
  source: string;
  style: CitationStyleId;
  duplicate: boolean;
  onAdd: (force: boolean) => void;
  onEdit: () => void;
  onDismiss: () => void;
}) {
  const items = useMemo(() => [item], [item]);
  const { entries } = useFormattedBibliography(items, style);
  const preview = entries?.[0];

  return (
    <section
      aria-label="Source found"
      className="bg-card ring-primary/30 flex flex-col gap-3 rounded-xl p-4 ring-1"
    >
      <p className="text-muted-foreground text-xs">Found via {source}. Check it before adding.</p>
      {preview ? (
        <p
          className="text-sm leading-relaxed text-pretty break-words"
          dangerouslySetInnerHTML={{ __html: preview.html }}
        />
      ) : (
        <p className="text-sm">{item.title}</p>
      )}

      {duplicate ? (
        <p role="status" className="text-sm text-pretty">
          This source is already in this bibliography.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => onAdd(duplicate)}>
          <Plus className="size-4" aria-hidden />
          {duplicate ? "Add it again" : "Add to bibliography"}
        </Button>
        <Button variant="outline" onClick={onEdit}>
          <PenLine className="size-4" aria-hidden />
          Edit first
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="ms-auto"
          aria-label="Discard"
          onClick={onDismiss}
        >
          <X className="size-4" aria-hidden />
        </Button>
      </div>
    </section>
  );
}
