"use client";

import { Images } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { baseName } from "@/lib/pdf/files";
import { parsePageRanges, rangeIndexes } from "@/lib/pdf/ranges";

import { ChoiceGroup } from "./choice-group";
import { OutputFiles, type OutputFile } from "./output-files";
import { PdfChip, PdfPicker, usePdfSource } from "./pdf-source";
import { canvasToBytes, openDocument, releaseCanvas, renderPage, scaleForDpi } from "./pdfjs";
import { RangeInput } from "./range-input";
import { TaskStatus } from "./task-status";
import { useTask } from "./use-task";

type Format = "png" | "jpeg";
const FORMATS: { value: Format; label: string }[] = [
  { value: "png", label: "PNG" },
  { value: "jpeg", label: "JPG" },
];

type Quality = "72" | "150" | "300";
const QUALITIES: { value: Quality; label: string }[] = [
  { value: "72", label: "Screen" },
  { value: "150", label: "Standard" },
  { value: "300", label: "Print" },
];

type Which = "all" | "some";
const WHICH: { value: Which; label: string }[] = [
  { value: "all", label: "All pages" },
  { value: "some", label: "Some pages" },
];

export function ToImagesPanel() {
  const task = useTask();
  const source = usePdfSource("read", task.run);
  const [format, setFormat] = useState<Format>("png");
  const [quality, setQuality] = useState<Quality>("150");
  const [which, setWhich] = useState<Which>("all");
  const [ranges, setRanges] = useState("");
  const [output, setOutput] = useState<OutputFile[]>([]);

  const pdf = source.pdf;
  if (!pdf) {
    return (
      <div className="flex flex-col gap-4">
        <PdfPicker onFiles={(files) => void source.choose(files)} />
        <TaskStatus state={task.state} />
      </div>
    );
  }

  const parsed = parsePageRanges(ranges, pdf.pageCount);
  const indexes =
    which === "all"
      ? Array.from({ length: pdf.pageCount }, (_, index) => index)
      : parsed.ok
        ? [...new Set(rangeIndexes(parsed.ranges))]
        : null;

  async function convert() {
    if (!pdf || !indexes) return;
    const type = format === "png" ? "image/png" : "image/jpeg";
    const base = baseName(pdf.name);
    const files = await task.run("Converting…", async (progress) => {
      const opened = await openDocument(pdf.bytes);
      try {
        const results: OutputFile[] = [];
        for (const [position, index] of indexes.entries()) {
          progress(`Converting page ${position + 1} of ${indexes.length}…`);
          const page = await opened.doc.getPage(index + 1);
          const canvas = await renderPage(page, scaleForDpi(page, Number(quality)));
          const bytes = await canvasToBytes(canvas, type, 0.9);
          releaseCanvas(canvas);
          page.cleanup();
          results.push({
            name: `${base}-page-${index + 1}.${format === "png" ? "png" : "jpg"}`,
            bytes,
            type,
          });
        }
        return results;
      } finally {
        await opened.close();
      }
    });
    if (files) setOutput(files);
  }

  const reset = () => setOutput([]);

  return (
    <div className="flex flex-col gap-4">
      <PdfChip
        pdf={pdf}
        onClear={() => {
          source.clear();
          reset();
        }}
      />
      <ChoiceGroup
        label="Format"
        options={FORMATS}
        value={format}
        onChange={(next) => {
          setFormat(next);
          reset();
        }}
      />
      <p className="text-muted-foreground -mt-2 text-sm">
        {format === "png"
          ? "PNG keeps text and diagrams crisp."
          : "JPG makes smaller files, best for photos and scans."}
      </p>
      <ChoiceGroup
        label="Resolution"
        options={QUALITIES}
        value={quality}
        onChange={(next) => {
          setQuality(next);
          reset();
        }}
      />
      <ChoiceGroup
        label="Pages"
        options={WHICH}
        value={which}
        onChange={(next) => {
          setWhich(next);
          reset();
        }}
      />
      {which === "some" ? (
        <RangeInput
          label="Pages to convert"
          value={ranges}
          result={parsed}
          hint={`Pages 1 to ${pdf.pageCount}.`}
          onChange={(value) => {
            setRanges(value);
            reset();
          }}
        />
      ) : null}

      <Button
        className="h-12 w-full sm:w-fit"
        disabled={!indexes || task.working}
        onClick={() => void convert()}
      >
        <Images className="size-4" aria-hidden />
        {indexes
          ? `Convert ${indexes.length} ${indexes.length === 1 ? "page" : "pages"}`
          : "Choose pages first"}
      </Button>

      <TaskStatus state={task.state} />
      <OutputFiles files={output} zipName={`${baseName(pdf.name)}-images.zip`} />
    </div>
  );
}
