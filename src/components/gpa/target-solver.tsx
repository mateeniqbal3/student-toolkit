"use client";

import { Target } from "lucide-react";
import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPoints, gpaNeededForTarget, type TargetVerdict } from "@/lib/gpa/calculate";

/**
 * "What do I need this semester?" — the question the calculator above cannot
 * answer, because the answer is the unknown rather than the average.
 *
 * The two figures that come from the transcript are prefilled but left
 * editable: a student planning ahead often wants to try a different starting
 * point than the one they have typed in.
 */
export function TargetSolver({
  currentCgpa,
  completedCredits,
  scaleMax,
}: {
  currentCgpa: number | null;
  completedCredits: number;
  scaleMax: number;
}) {
  const [target, setTarget] = useState("");
  const [current, setCurrent] = useState("");
  const [completed, setCompleted] = useState("");
  const [planned, setPlanned] = useState("15");

  // An empty field falls back to what the transcript says, so the tool is
  // useful immediately and still overridable.
  const currentValue = current.trim() === "" ? (currentCgpa ?? 0) : Number(current);
  const completedValue = completed.trim() === "" ? completedCredits : Number(completed);

  const result = gpaNeededForTarget({
    targetCgpa: Number(target),
    currentCgpa: currentValue,
    completedCredits: completedValue,
    plannedCredits: Number(planned),
    scaleMax,
  });

  const showResult = target.trim() !== "";

  return (
    <section
      aria-labelledby="target-heading"
      className="bg-card ring-foreground/10 flex flex-col gap-4 rounded-xl p-4 ring-1"
    >
      <div className="flex items-center gap-2">
        <Target className="text-primary size-4" aria-hidden />
        <h2 id="target-heading" className="font-display text-sm font-semibold">
          What do I need this semester?
        </h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          id="target-cgpa"
          label={`Target CGPA (out of ${scaleMax})`}
          value={target}
          onChange={setTarget}
          placeholder={String(Math.min(scaleMax, 3.5))}
          max={scaleMax}
        />
        <Field
          id="target-current"
          label="Current CGPA"
          value={current}
          onChange={setCurrent}
          placeholder={currentCgpa === null ? "0.00" : formatPoints(currentCgpa)}
          max={scaleMax}
        />
        <Field
          id="target-completed"
          label="Credits completed"
          value={completed}
          onChange={setCompleted}
          placeholder={String(completedCredits)}
          max={500}
        />
        <Field
          id="target-planned"
          label="Credits this semester"
          value={planned}
          onChange={setPlanned}
          placeholder="15"
          max={60}
        />
      </div>

      {showResult ? <Verdict result={result} scaleMax={scaleMax} /> : null}
    </section>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  max,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  max: number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-muted-foreground text-xs">
        {label}
      </Label>
      <Input
        id={id}
        className="h-9"
        type="number"
        inputMode="decimal"
        min={0}
        max={max}
        step="any"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

const VERDICT_TONE: Record<TargetVerdict, string> = {
  invalid: "text-muted-foreground",
  "already-there": "text-primary",
  achievable: "text-primary",
  demanding: "text-highlight",
  impossible: "text-destructive",
};

function Verdict({
  result,
  scaleMax,
}: {
  result: ReturnType<typeof gpaNeededForTarget>;
  scaleMax: number;
}) {
  const message = describe(result, scaleMax);

  return (
    <div className="flex flex-col gap-1" aria-live="polite">
      <p className={`text-pretty ${VERDICT_TONE[result.verdict]}`}>{message}</p>
      {result.formula !== null && result.verdict !== "invalid" ? (
        <p className="text-muted-foreground font-mono text-xs break-words">{result.formula}</p>
      ) : null}
    </div>
  );
}

function describe(result: ReturnType<typeof gpaNeededForTarget>, scaleMax: number): string {
  const required = formatPoints(result.required);

  switch (result.verdict) {
    case "invalid":
      return "Fill in a target between 0 and the top of the scale, and the credits you are taking.";
    case "already-there":
      return "You are already past that target — anything above zero keeps you there.";
    case "achievable":
      return `Average ${required} this semester and you hit your target.`;
    case "demanding":
      return `You need ${required} this semester. That is all but a clean sweep on a ${scaleMax}-point scale.`;
    case "impossible":
      return `That target needs ${required} this semester, which is above the ${scaleMax} maximum. Spread it over more than one semester.`;
  }
}
