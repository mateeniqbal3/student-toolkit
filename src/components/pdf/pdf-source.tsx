"use client";

import { FileText, X } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { PdfError } from "@/lib/pdf/errors";
import { formatBytes, looksLikePdf } from "@/lib/pdf/files";

import { FilePicker } from "./file-picker";
import { runPdfJob } from "./pdf-worker-client";
import { openDocument } from "./pdfjs";

export interface LoadedPdf {
  name: string;
  bytes: Uint8Array;
  pageCount: number;
}

/** Reads a file the student chose and checks that it is a PDF. */
export async function readPdfFile(file: File, mode: "edit" | "read"): Promise<LoadedPdf> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!looksLikePdf(bytes)) throw new PdfError("invalid");
  if (mode === "edit") {
    // Checked with pdf-lib, which does the editing, so a locked file is
    // turned away now rather than after the student has set everything up.
    const { pageCount } = await runPdfJob({ op: "info", bytes });
    return { name: file.name, bytes, pageCount };
  }
  // Reading only needs pdf.js, which opens files locked against editing.
  const opened = await openDocument(bytes);
  const pageCount = opened.doc.numPages;
  await opened.close();
  return { name: file.name, bytes, pageCount };
}

/**
 * The one PDF an operation works on: pick it, see what was picked, swap it.
 * `mode` says whether the operation edits the file or only reads it.
 */
export function usePdfSource(
  mode: "edit" | "read",
  run: <T>(message: string, work: () => Promise<T>) => Promise<T | undefined>,
) {
  const [pdf, setPdf] = useState<LoadedPdf | null>(null);

  const choose = useCallback(
    async (files: File[]) => {
      const [file] = files;
      if (!file) return;
      const loaded = await run("Opening the PDF…", () => readPdfFile(file, mode));
      if (loaded) setPdf(loaded);
    },
    [mode, run],
  );

  return { pdf, choose, clear: () => setPdf(null) };
}

export function PdfPicker({ onFiles }: { onFiles: (files: File[]) => void }) {
  return (
    <FilePicker
      accept="application/pdf,.pdf"
      label="Choose a PDF"
      hint="Or drop it here. It stays on this device."
      onFiles={onFiles}
    />
  );
}

/** The chosen file, with a way to pick another. */
export function PdfChip({ pdf, onClear }: { pdf: LoadedPdf; onClear: () => void }) {
  return (
    <div className="bg-muted flex items-center gap-3 rounded-xl px-3 py-2">
      <FileText className="text-primary size-5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{pdf.name}</p>
        <p className="text-muted-foreground text-xs tabular-nums">
          {pdf.pageCount === 1 ? "1 page" : `${pdf.pageCount} pages`} ·{" "}
          {formatBytes(pdf.bytes.length)}
        </p>
      </div>
      <Button variant="ghost" size="icon-sm" aria-label="Choose a different PDF" onClick={onClear}>
        <X className="size-4" aria-hidden />
      </Button>
    </div>
  );
}
