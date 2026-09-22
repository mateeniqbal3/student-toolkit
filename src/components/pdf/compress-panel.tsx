"use client";

import { Minimize2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { baseName, formatBytes, savedPercent } from "@/lib/pdf/files";
import type { RasterPage } from "@/lib/pdf/operations";

import { ChoiceGroup } from "@/components/choice-group";
import { OutputFiles, type OutputFile } from "./output-files";
import { PdfChip, PdfPicker, usePdfSource } from "./pdf-source";
import { runPdfJob } from "./pdf-worker-client";
import { canvasToBytes, openDocument, releaseCanvas, renderPage, scaleForDpi } from "./pdfjs";
import { TaskStatus } from "./task-status";
import { useTask } from "./use-task";

type Level = "lossless" | "balanced" | "smallest";

const LEVELS: { value: Level; label: string }[] = [
  { value: "lossless", label: "Light" },
  { value: "balanced", label: "Strong" },
  { value: "smallest", label: "Smallest" },
];

/** Resolution and JPEG quality for the levels that redraw pages as images. */
const RASTER: Record<Exclude<Level, "lossless">, { dpi: number; quality: number }> = {
  balanced: { dpi: 144, quality: 0.72 },
  smallest: { dpi: 96, quality: 0.55 },
};

const EXPLANATIONS: Record<Level, string> = {
  lossless:
    "Tidies the file's structure without touching its contents. Text stays selectable. Saves a little on most files, a lot on few.",
  balanced:
    "Redraws every page as an image. Best for scans and photos of pages, often several times smaller, and still sharp on screen and when printed. Text can no longer be selected or searched.",
  smallest:
    "As Strong, at a lower resolution, for tight upload limits. Fine to read on screen; small print may blur.",
};

export function CompressPanel() {
  const task = useTask();
  // Opened for reading: the stronger levels work even on PDFs locked against editing.
  const source = usePdfSource("read", task.run);
  const [level, setLevel] = useState<Level>("balanced");
  const [result, setResult] = useState<{ file: OutputFile; before: number } | null>(null);

  const pdf = source.pdf;
  if (!pdf) {
    return (
      <div className="flex flex-col gap-4">
        <PdfPicker onFiles={(files) => void source.choose(files)} />
        <TaskStatus state={task.state} />
      </div>
    );
  }

  async function compress() {
    if (!pdf) return;
    const bytes = await task.run("Compressing…", async (progress) => {
      if (level === "lossless") return runPdfJob({ op: "compress", bytes: pdf.bytes });

      const { dpi, quality } = RASTER[level];
      const opened = await openDocument(pdf.bytes);
      try {
        const pages: RasterPage[] = [];
        for (let number = 1; number <= opened.doc.numPages; number += 1) {
          progress(`Compressing page ${number} of ${opened.doc.numPages}…`);
          const page = await opened.doc.getPage(number);
          // The page's size as seen, rotation included, so the new page matches it.
          const { width, height } = page.getViewport({ scale: 1 });
          const canvas = await renderPage(page, scaleForDpi(page, dpi));
          pages.push({ jpeg: await canvasToBytes(canvas, "image/jpeg", quality), width, height });
          releaseCanvas(canvas);
          page.cleanup();
        }
        progress("Putting the pages back together…");
        return await runPdfJob({ op: "rasters", pages });
      } finally {
        await opened.close();
      }
    });
    if (bytes) {
      setResult({
        before: pdf.bytes.length,
        file: { name: `${baseName(pdf.name)}-compressed.pdf`, bytes, type: "application/pdf" },
      });
    }
  }

  const saved = result ? savedPercent(result.before, result.file.bytes.length) : 0;

  return (
    <div className="flex flex-col gap-4">
      <PdfChip
        pdf={pdf}
        onClear={() => {
          source.clear();
          setResult(null);
        }}
      />

      <ChoiceGroup
        label="Compression"
        options={LEVELS}
        value={level}
        onChange={(next) => {
          setLevel(next);
          setResult(null);
        }}
      />
      <p className="text-muted-foreground -mt-2 text-sm text-pretty">{EXPLANATIONS[level]}</p>

      <Button
        className="h-12 w-full sm:w-fit"
        disabled={task.working}
        onClick={() => void compress()}
      >
        <Minimize2 className="size-4" aria-hidden />
        Compress
      </Button>

      <TaskStatus state={task.state} />

      {result && saved <= 0 ? (
        <p role="status" className="bg-muted rounded-lg px-3 py-2 text-sm text-pretty">
          This PDF is already compact: the result came out at{" "}
          {formatBytes(result.file.bytes.length)}, no smaller than the original{" "}
          {formatBytes(result.before)}. Keep your original
          {level === "lossless" ? ", or try Strong if it is a scan." : "."}
        </p>
      ) : null}
      {result && saved > 0 ? (
        <OutputFiles
          files={[result.file]}
          zipName="compressed.zip"
          summary={
            <>
              {formatBytes(result.before)} → {formatBytes(result.file.bytes.length)},{" "}
              <strong className="text-foreground">{saved}% smaller</strong>.
            </>
          }
        />
      ) : null}
    </div>
  );
}
