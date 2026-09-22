"use client";

import { Hash } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { baseName } from "@/lib/pdf/files";
import type { NumberPosition } from "@/lib/pdf/operations";

import { ChoiceGroup } from "./choice-group";
import { OutputFiles, type OutputFile } from "./output-files";
import { PdfChip, PdfPicker, usePdfSource } from "./pdf-source";
import { runPdfJob } from "./pdf-worker-client";
import { TaskStatus } from "./task-status";
import { useTask } from "./use-task";

const POSITIONS: { value: NumberPosition; label: string }[] = [
  { value: "bottom-center", label: "Bottom centre" },
  { value: "bottom-right", label: "Bottom right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "top-center", label: "Top centre" },
  { value: "top-right", label: "Top right" },
  { value: "top-left", label: "Top left" },
];

/** The label formats, as templates the worker fills in. Here, so they can be translated. */
type Style = "n" | "page-n" | "page-n-of" | "n-of";
const STYLES: { value: Style; label: string; template: string }[] = [
  { value: "n", label: "1", template: "{n}" },
  { value: "page-n", label: "Page 1", template: "Page {n}" },
  { value: "page-n-of", label: "Page 1 of 10", template: "Page {n} of {total}" },
  { value: "n-of", label: "1 / 10", template: "{n} / {total}" },
];

type Size = "9" | "11" | "14";
const SIZES: { value: Size; label: string }[] = [
  { value: "9", label: "Small" },
  { value: "11", label: "Medium" },
  { value: "14", label: "Large" },
];

export function PageNumbersPanel() {
  const task = useTask();
  const source = usePdfSource("edit", task.run);
  const [position, setPosition] = useState<NumberPosition>("bottom-center");
  const [style, setStyle] = useState<Style>("n");
  const [size, setSize] = useState<Size>("11");
  const [startAt, setStartAt] = useState("1");
  const [skipFirst, setSkipFirst] = useState(false);
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

  const start = Number.parseInt(startAt, 10);
  const validStart = Number.isSafeInteger(start) && start >= 0 && start <= 9999;

  async function apply() {
    if (!pdf || !validStart) return;
    const template = STYLES.find((option) => option.value === style)?.template ?? "{n}";
    const bytes = await task.run("Numbering pages…", () =>
      runPdfJob({
        op: "pageNumbers",
        bytes: pdf.bytes,
        options: { position, template, startAt: start, skipFirst, fontSize: Number(size) },
      }),
    );
    if (bytes) {
      setOutput([{ name: `${baseName(pdf.name)}-numbered.pdf`, bytes, type: "application/pdf" }]);
    }
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
        label="Where"
        options={POSITIONS}
        value={position}
        onChange={(next) => {
          setPosition(next);
          reset();
        }}
      />
      <ChoiceGroup
        label="Style"
        options={STYLES}
        value={style}
        onChange={(next) => {
          setStyle(next);
          reset();
        }}
      />
      <ChoiceGroup
        label="Size"
        options={SIZES}
        value={size}
        onChange={(next) => {
          setSize(next);
          reset();
        }}
      />
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="start-at" className="text-muted-foreground text-xs">
            First number
          </Label>
          <Input
            id="start-at"
            type="number"
            inputMode="numeric"
            min={0}
            className="h-10 w-24"
            value={startAt}
            aria-invalid={!validStart}
            onChange={(event) => {
              setStartAt(event.target.value);
              reset();
            }}
          />
        </div>
        <div className="flex items-center gap-2 pb-2">
          <Switch
            id="skip-first"
            checked={skipFirst}
            onCheckedChange={(on) => {
              setSkipFirst(on);
              reset();
            }}
          />
          <Label htmlFor="skip-first" className="text-sm font-normal">
            Leave the cover page unnumbered
          </Label>
        </div>
      </div>

      <Button
        className="h-12 w-full sm:w-fit"
        disabled={!validStart || task.working}
        onClick={() => void apply()}
      >
        <Hash className="size-4" aria-hidden />
        Add page numbers
      </Button>

      <TaskStatus state={task.state} />
      <OutputFiles files={output} zipName="numbered.zip" />
    </div>
  );
}
