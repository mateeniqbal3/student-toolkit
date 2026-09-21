"use client";

import { Download, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  bibliographyClipboardHtml,
  bibliographyText,
  exportSources,
  type ExportFormat,
  type FormattedEntry,
} from "@/lib/citation/format";
import { getStyle } from "@/lib/citation/styles";
import type { CitationStyleId, CslItem } from "@/lib/citation/types";

import { downloadFile, fileSlug } from "./clipboard";
import { CopyButton } from "./copy-button";
import type { FormattedState } from "./use-formatted-bibliography";

const EXPORTS: { format: ExportFormat; label: string; extension: string; type: string }[] = [
  { format: "bibtex", label: "BibTeX", extension: "bib", type: "application/x-bibtex" },
  { format: "ris", label: "RIS", extension: "ris", type: "application/x-research-info-systems" },
];

export function Bibliography({
  projectName,
  style,
  items,
  formatted,
  onEdit,
  onDelete,
}: {
  projectName: string;
  style: CitationStyleId;
  items: readonly CslItem[];
  formatted: FormattedState;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const { entries, failed, retry } = formatted;
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const hanging = getStyle(style).hangingIndent;

  async function download(format: (typeof EXPORTS)[number]) {
    setExporting(format.format);
    try {
      const content = await exportSources(items, format.format);
      downloadFile(`${fileSlug(projectName)}.${format.extension}`, content, format.type);
    } catch {
      // The exporter could not be loaded (offline before it was ever cached);
      // the button simply stops spinning and can be pressed again.
    } finally {
      setExporting(null);
    }
  }

  const heading = (
    <h2 id="references-heading" className="font-display font-semibold">
      References <span className="text-muted-foreground font-normal">({items.length})</span>
    </h2>
  );

  if (items.length === 0) {
    return (
      <section aria-labelledby="references-heading" className="flex flex-col gap-2">
        {heading}
        <p className="text-muted-foreground text-sm text-pretty">
          Nothing here yet. Paste an identifier above, or type a source in by hand, and it will
          appear here formatted and ready to copy.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="references-heading" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {heading}
        <div className="ms-auto flex flex-wrap gap-2">
          <CopyButton
            size="sm"
            label="Copy all"
            disabled={!entries || entries.length === 0}
            getContent={() => ({
              text: bibliographyText(entries ?? []),
              html: bibliographyClipboardHtml(entries ?? [], style),
            })}
          />
          {EXPORTS.map((format) => (
            <Button
              key={format.format}
              variant="outline"
              size="sm"
              disabled={exporting !== null}
              onClick={() => void download(format)}
            >
              <Download
                className={`size-3.5 ${exporting === format.format ? "animate-pulse" : ""}`}
                aria-hidden
              />
              {format.label}
            </Button>
          ))}
        </div>
      </div>

      {failed && !entries ? (
        <div role="status" className="flex flex-col items-start gap-2 text-sm">
          <p className="text-muted-foreground text-pretty">
            The citation formatter has not downloaded yet. It needs a connection once; after that it
            works offline.
          </p>
          <Button variant="outline" size="sm" onClick={retry}>
            <RefreshCw className="size-3.5" aria-hidden />
            Try again
          </Button>
        </div>
      ) : !entries ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          <span className="sr-only">Formatting your references</span>
          {items.slice(0, 3).map((item) => (
            <Skeleton key={item.id} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <ol className="flex flex-col">
          {entries.map((entry) => (
            <Entry
              key={entry.id}
              entry={entry}
              hanging={hanging}
              onEdit={() => onEdit(entry.id)}
              onDelete={() => onDelete(entry.id)}
            />
          ))}
        </ol>
      )}

      <p className="text-muted-foreground text-xs text-pretty">
        “Copy all” keeps the italics and hanging indent when pasted into Word or Google Docs. BibTeX
        is for LaTeX and Overleaf; RIS imports into Zotero, Mendeley and EndNote.
      </p>
    </section>
  );
}

function Entry({
  entry,
  hanging,
  onEdit,
  onDelete,
}: {
  entry: FormattedEntry;
  hanging: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="border-border flex flex-col gap-2 border-b py-3 last:border-b-0">
      <p
        className={`text-sm leading-relaxed break-words ${hanging ? "ps-8 -indent-8" : ""}`}
        dangerouslySetInnerHTML={{ __html: entry.html }}
      />
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="text-muted-foreground text-xs">
          In text: <span className="text-foreground">{entry.inText}</span>
        </p>
        <CopyButton
          variant="ghost"
          size="xs"
          className="me-auto"
          label="Copy"
          aria-label={`Copy in-text citation ${entry.inText}`}
          getContent={() => ({ text: entry.inText })}
        />
        <CopyButton
          variant="ghost"
          size="icon-sm"
          iconOnly
          label="Copy reference"
          getContent={() => ({ text: entry.text, html: `<p>${entry.html}</p>` })}
        />
        <Button variant="ghost" size="icon-sm" aria-label="Edit reference" onClick={onEdit}>
          <Pencil className="size-4" aria-hidden />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Delete reference" onClick={onDelete}>
          <Trash2 className="size-4" aria-hidden />
        </Button>
      </div>
    </li>
  );
}
