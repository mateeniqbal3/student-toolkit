"use client";

import { Check, Copy, Download, TextCursorInput } from "lucide-react";
import { useState } from "react";

import { downloadFile } from "@/components/download";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { baseName } from "@/lib/pdf/files";

import { PdfChip, PdfPicker, usePdfSource } from "./pdf-source";
import { extractText, openDocument } from "./pdfjs";
import { TaskStatus } from "./task-status";
import { useTask } from "./use-task";

function joinPages(pages: readonly string[], markers: boolean): string {
  if (!markers) return pages.filter(Boolean).join("\n\n");
  return pages.map((text, index) => `--- Page ${index + 1} ---\n${text}`).join("\n\n");
}

export function TextPanel() {
  const task = useTask();
  const source = usePdfSource("read", task.run);
  const [pages, setPages] = useState<string[] | null>(null);
  const [markers, setMarkers] = useState(true);
  const [copied, setCopied] = useState(false);

  const pdf = source.pdf;
  if (!pdf) {
    return (
      <div className="flex flex-col gap-4">
        <PdfPicker onFiles={(files) => void source.choose(files)} />
        <TaskStatus state={task.state} />
      </div>
    );
  }

  async function extract() {
    if (!pdf) return;
    const result = await task.run("Reading…", async (progress) => {
      const opened = await openDocument(pdf.bytes);
      try {
        return await extractText(opened.doc, (done, total) =>
          progress(`Reading page ${done} of ${total}…`),
        );
      } finally {
        await opened.close();
      }
    });
    if (result) setPages(result);
  }

  const empty = pages !== null && pages.every((text) => !text.trim());
  const text = pages ? joinPages(pages, markers) : "";

  return (
    <div className="flex flex-col gap-4">
      <PdfChip
        pdf={pdf}
        onClear={() => {
          source.clear();
          setPages(null);
        }}
      />

      {pages === null ? (
        <Button
          className="h-12 w-full sm:w-fit"
          disabled={task.working}
          onClick={() => void extract()}
        >
          <TextCursorInput className="size-4" aria-hidden />
          Extract the text
        </Button>
      ) : null}

      <TaskStatus state={task.state} />

      {empty ? (
        <p role="status" className="bg-muted rounded-lg px-3 py-2 text-sm text-pretty">
          No text was found. This PDF is probably a scan or photos of pages, which hold pictures of
          words rather than text. Reading those needs OCR, which this tool does not do.
        </p>
      ) : null}

      {pages !== null && !empty ? (
        <section aria-label="Extracted text" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch id="page-markers" checked={markers} onCheckedChange={setMarkers} />
              <Label htmlFor="page-markers" className="text-sm font-normal">
                Mark where each page starts
              </Label>
            </div>
            <div className="ms-auto flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await navigator.clipboard.writeText(text);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 2000);
                }}
              >
                {copied ? (
                  <Check className="size-3.5" aria-hidden />
                ) : (
                  <Copy className="size-3.5" aria-hidden />
                )}
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  downloadFile(`${baseName(pdf.name)}.txt`, text, "text/plain;charset=utf-8")
                }
              >
                <Download className="size-3.5" aria-hidden />
                .txt
              </Button>
            </div>
          </div>
          <Textarea
            aria-label="Text from the PDF"
            readOnly
            className="min-h-[50vh] font-mono text-sm leading-relaxed"
            value={text}
          />
        </section>
      ) : null}
    </div>
  );
}
