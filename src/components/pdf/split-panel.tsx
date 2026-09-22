"use client";

import { Scissors } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { baseName } from "@/lib/pdf/files";
import {
  everyNPages,
  formatRange,
  parsePageRanges,
  rangeIndexes,
  type PageRange,
} from "@/lib/pdf/ranges";

import { ChoiceGroup } from "@/components/choice-group";
import { OutputFiles, type OutputFile } from "./output-files";
import { PdfChip, PdfPicker, usePdfSource } from "./pdf-source";
import { runPdfJob } from "./pdf-worker-client";
import { RangeInput } from "./range-input";
import { TaskStatus } from "./task-status";
import { useTask } from "./use-task";

type Mode = "extract" | "ranges" | "every";

const MODES: { value: Mode; label: string }[] = [
  { value: "extract", label: "Pick pages" },
  { value: "ranges", label: "One file per range" },
  { value: "every", label: "Every N pages" },
];

export function SplitPanel() {
  const task = useTask();
  const source = usePdfSource("edit", task.run);
  const [mode, setMode] = useState<Mode>("extract");
  const [ranges, setRanges] = useState("");
  const [every, setEvery] = useState("1");
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
  const size = Number.parseInt(every, 10);
  const groups: PageRange[] | null =
    mode === "every"
      ? Number.isSafeInteger(size) && size >= 1
        ? everyNPages(pdf.pageCount, size)
        : null
      : parsed.ok
        ? parsed.ranges
        : null;
  const base = baseName(pdf.name);

  async function split() {
    if (!pdf || !groups) return;
    if (mode === "extract") {
      const bytes = await task.run("Extracting pages…", () =>
        runPdfJob({ op: "select", bytes: pdf.bytes, indexes: rangeIndexes(groups) }),
      );
      if (bytes) {
        const label = groups.map(formatRange).join("_");
        setOutput([{ name: `${base}-pages-${label}.pdf`, bytes, type: "application/pdf" }]);
      }
      return;
    }
    const files = await task.run("Splitting…", () =>
      runPdfJob({
        op: "split",
        bytes: pdf.bytes,
        groups: groups.map((range) => rangeIndexes([range])),
      }),
    );
    if (files) {
      setOutput(
        files.map((bytes, index) => ({
          name: `${base}-pages-${formatRange(groups[index] ?? { from: 0, to: 0 })}.pdf`,
          bytes,
          type: "application/pdf",
        })),
      );
    }
  }

  const count = groups?.length ?? 0;
  const pagesPicked = groups ? rangeIndexes(groups).length : 0;

  return (
    <div className="flex flex-col gap-4">
      <PdfChip
        pdf={pdf}
        onClear={() => {
          source.clear();
          setOutput([]);
        }}
      />

      <ChoiceGroup
        label="How to split"
        options={MODES}
        value={mode}
        onChange={(next) => {
          setMode(next);
          setOutput([]);
        }}
      />

      {mode === "every" ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="split-every" className="text-muted-foreground text-xs">
            Pages per file
          </Label>
          <Input
            id="split-every"
            type="number"
            inputMode="numeric"
            min={1}
            max={pdf.pageCount}
            className="h-10 w-28"
            value={every}
            onChange={(event) => {
              setEvery(event.target.value);
              setOutput([]);
            }}
          />
        </div>
      ) : (
        <RangeInput
          label={mode === "extract" ? "Pages to keep" : "Ranges, one file each"}
          value={ranges}
          result={parsed}
          hint={
            mode === "extract"
              ? `Pages 1 to ${pdf.pageCount}. They go into one new PDF, in the order you type them.`
              : "Each comma-separated range becomes its own PDF: 1-3, 4-10 makes two files."
          }
          onChange={(value) => {
            setRanges(value);
            setOutput([]);
          }}
        />
      )}

      <Button
        className="h-12 w-full sm:w-fit"
        disabled={!groups || task.working}
        onClick={() => void split()}
      >
        <Scissors className="size-4" aria-hidden />
        {!groups
          ? "Choose pages first"
          : mode === "extract"
            ? `Make a PDF of ${pagesPicked} ${pagesPicked === 1 ? "page" : "pages"}`
            : `Split into ${count} ${count === 1 ? "file" : "files"}`}
      </Button>

      <TaskStatus state={task.state} />
      <OutputFiles files={output} zipName={`${base}-split.zip`} />
    </div>
  );
}
