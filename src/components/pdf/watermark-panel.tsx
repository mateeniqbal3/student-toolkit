"use client";

import { Stamp } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { baseName } from "@/lib/pdf/files";
import type { WatermarkOptions } from "@/lib/pdf/operations";
import { parsePageRanges, rangeIndexes } from "@/lib/pdf/ranges";

import { ChoiceGroup } from "./choice-group";
import { OutputFiles, type OutputFile } from "./output-files";
import { PdfChip, PdfPicker, usePdfSource } from "./pdf-source";
import { runPdfJob } from "./pdf-worker-client";
import { RangeInput } from "./range-input";
import { TaskStatus } from "./task-status";
import { useTask } from "./use-task";

type Size = "48" | "80" | "140";
const SIZES: { value: Size; label: string }[] = [
  { value: "48", label: "Medium" },
  { value: "80", label: "Large" },
  { value: "140", label: "Fill the page" },
];

type Strength = "0.15" | "0.3" | "0.5";
const STRENGTHS: { value: Strength; label: string }[] = [
  { value: "0.15", label: "Faint" },
  { value: "0.3", label: "Medium" },
  { value: "0.5", label: "Strong" },
];

const ANGLES: { value: WatermarkOptions["angle"]; label: string }[] = [
  { value: "diagonal", label: "Diagonal" },
  { value: "horizontal", label: "Straight" },
];

type Which = "all" | "some";
const WHICH: { value: Which; label: string }[] = [
  { value: "all", label: "Every page" },
  { value: "some", label: "Some pages" },
];

export function WatermarkPanel() {
  const task = useTask();
  const source = usePdfSource("edit", task.run);
  const [text, setText] = useState("DRAFT");
  const [size, setSize] = useState<Size>("80");
  const [strength, setStrength] = useState<Strength>("0.3");
  const [angle, setAngle] = useState<WatermarkOptions["angle"]>("diagonal");
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
  const pages = which === "all" ? undefined : parsed.ok ? rangeIndexes(parsed.ranges) : null;
  const ready = text.trim() !== "" && pages !== null;

  async function apply() {
    if (!pdf || pages === null) return;
    const bytes = await task.run("Adding the watermark…", () =>
      runPdfJob({
        op: "watermark",
        bytes: pdf.bytes,
        options: {
          text,
          fontSize: Number(size),
          opacity: Number(strength),
          angle,
          ...(pages ? { pages } : {}),
        },
      }),
    );
    if (bytes) {
      setOutput([
        { name: `${baseName(pdf.name)}-watermarked.pdf`, bytes, type: "application/pdf" },
      ]);
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
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="watermark-text" className="text-muted-foreground text-xs">
          Watermark text
        </Label>
        <Input
          id="watermark-text"
          className="h-10"
          maxLength={60}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            reset();
          }}
        />
      </div>
      <ChoiceGroup
        label="Size"
        options={SIZES}
        value={size}
        onChange={(next) => {
          setSize(next);
          reset();
        }}
      />
      <ChoiceGroup
        label="Strength"
        options={STRENGTHS}
        value={strength}
        onChange={(next) => {
          setStrength(next);
          reset();
        }}
      />
      <ChoiceGroup
        label="Angle"
        options={ANGLES}
        value={angle}
        onChange={(next) => {
          setAngle(next);
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
          label="Pages to stamp"
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
        disabled={!ready || task.working}
        onClick={() => void apply()}
      >
        <Stamp className="size-4" aria-hidden />
        Add watermark
      </Button>

      <TaskStatus state={task.state} />
      <OutputFiles files={output} zipName="watermarked.zip" />
    </div>
  );
}
