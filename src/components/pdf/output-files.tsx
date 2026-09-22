"use client";

import { CheckCircle2, Download, FileArchive } from "lucide-react";
import type { ReactNode } from "react";

import { downloadBlob } from "@/components/download";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/pdf/files";

export interface OutputFile {
  name: string;
  bytes: Uint8Array;
  type: string;
}

function blobOf(file: OutputFile): Blob {
  // Copied into a fresh ArrayBuffer: a Blob cannot be built from a view over
  // a shared or resizable buffer.
  return new Blob([file.bytes.slice()], { type: file.type });
}

/** Several files in one download. Already-compressed files are stored, not squeezed again. */
async function downloadZip(files: readonly OutputFile[], zipName: string) {
  const { zipSync } = await import("fflate");
  const used = new Set<string>();
  const entries: Record<string, [Uint8Array, { level: 0 }]> = {};
  for (const file of files) {
    let name = file.name;
    for (let copy = 2; used.has(name); copy += 1)
      name = file.name.replace(/(\.[^.]+)?$/, ` (${copy})$1`);
    used.add(name);
    entries[name] = [file.bytes, { level: 0 }];
  }
  const zipped = zipSync(entries);
  downloadBlob(zipName, new Blob([zipped.slice()], { type: "application/zip" }));
}

/**
 * The finished files, ready to save. One file gets one big button; several
 * get a list and a zip of them all, because a phone asks about every single
 * download.
 */
export function OutputFiles({
  files,
  zipName,
  summary,
}: {
  files: OutputFile[];
  zipName: string;
  /** A line about the result, such as how much smaller it is. */
  summary?: ReactNode;
}) {
  if (files.length === 0) return null;
  const [first] = files;

  return (
    <section
      aria-label="Result"
      className="bg-card ring-foreground/10 flex flex-col gap-3 rounded-xl p-4 ring-1"
    >
      <p className="flex items-center gap-2 font-medium">
        <CheckCircle2 className="text-primary size-5" aria-hidden />
        {files.length === 1 ? "Ready" : `${files.length} files ready`}
      </p>
      {summary ? <div className="text-muted-foreground text-sm text-pretty">{summary}</div> : null}

      {files.length === 1 && first ? (
        <Button
          className="h-12 w-full sm:w-fit"
          onClick={() => downloadBlob(first.name, blobOf(first))}
        >
          <Download className="size-4" aria-hidden />
          Download {first.name} ({formatBytes(first.bytes.length)})
        </Button>
      ) : (
        <>
          <Button className="h-12 w-full sm:w-fit" onClick={() => void downloadZip(files, zipName)}>
            <FileArchive className="size-4" aria-hidden />
            Download all as .zip
          </Button>
          <ul aria-label="Files" className="flex max-h-72 flex-col overflow-y-auto">
            {files.map((file, index) => (
              <li
                key={`${file.name}-${index}`}
                className="flex items-center gap-2 border-b py-1.5 text-sm last:border-b-0"
              >
                <span className="min-w-0 flex-1 truncate">{file.name}</span>
                <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                  {formatBytes(file.bytes.length)}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Download ${file.name}`}
                  onClick={() => downloadBlob(file.name, blobOf(file))}
                >
                  <Download className="size-3.5" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
