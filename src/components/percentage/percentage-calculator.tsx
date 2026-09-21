"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "cn";
import {
  applyChange,
  formatNumber,
  marksToPercent,
  parseField,
  percentChange,
  percentOf,
  reversePercent,
  weightedGrade,
  whatPercent,
  type PercentageResult,
  type WeightedComponent,
} from "@/lib/percentage/calculate";

const MODES = [
  { id: "percent-of", label: "% of a number" },
  { id: "what-percent", label: "X is what % of Y" },
  { id: "change", label: "Change between two" },
  { id: "apply", label: "Add or take off %" },
  { id: "reverse", label: "Work backwards" },
  { id: "marks", label: "Marks to %" },
  { id: "weighted", label: "Weighted grade" },
] as const;

type Mode = (typeof MODES)[number]["id"];

type Direction = "increase" | "decrease";

function newComponent(name = ""): WeightedComponent {
  return { id: crypto.randomUUID(), name, obtained: "", total: "", weight: "" };
}

export function PercentageCalculator() {
  const [mode, setMode] = useState<Mode>("percent-of");
  const [first, setFirst] = useState("");
  const [second, setSecond] = useState("");
  const [direction, setDirection] = useState<Direction>("increase");
  const [components, setComponents] = useState<WeightedComponent[]>(() => [
    newComponent("Assignments"),
    newComponent("Midterm"),
    newComponent("Final"),
  ]);

  const a = parseField(first);
  const b = parseField(second);

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="mode-heading" className="flex flex-col gap-2">
        <h2 id="mode-heading" className="font-display text-sm font-semibold">
          What are you working out?
        </h2>

        {/* A wrapping set of buttons rather than a tab strip: seven labels do
            not fit on one line at 360px, and a horizontally scrolling strip
            hides the options a student is trying to choose between. */}
        <div role="group" aria-labelledby="mode-heading" className="flex flex-wrap gap-2">
          {MODES.map((option) => (
            <Button
              key={option.id}
              size="sm"
              variant={mode === option.id ? "default" : "outline"}
              aria-pressed={mode === option.id}
              onClick={() => setMode(option.id)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </section>

      {mode === "weighted" ? (
        <WeightedPanel components={components} onChange={setComponents} />
      ) : (
        <SimplePanel
          mode={mode}
          first={first}
          second={second}
          direction={direction}
          onFirst={setFirst}
          onSecond={setSecond}
          onDirection={setDirection}
          result={solve(mode, a, b, direction)}
        />
      )}
    </div>
  );
}

function solve(
  mode: Exclude<Mode, "weighted">,
  a: number | null,
  b: number | null,
  direction: Direction,
): PercentageResult {
  switch (mode) {
    case "percent-of":
      return percentOf(a, b);
    case "what-percent":
      return whatPercent(a, b);
    case "change":
      return percentChange(a, b);
    case "apply":
      return applyChange(a, b, direction);
    case "reverse":
      return reversePercent(a, b, direction);
    case "marks":
      return marksToPercent(a, b);
  }
}

const LABELS: Record<
  Exclude<Mode, "weighted">,
  { first: string; second: string; suffix?: string }
> = {
  "percent-of": { first: "Percentage", second: "Of what number" },
  "what-percent": { first: "This number", second: "Is what percent of" },
  change: { first: "From", second: "To" },
  apply: { first: "Starting number", second: "Percentage" },
  reverse: { first: "Number after the change", second: "Percentage that was applied" },
  marks: { first: "Marks obtained", second: "Total marks" },
};

const HINTS: Record<Exclude<Mode, "weighted">, string> = {
  "percent-of": "Takes a share of a number. 15% of 200 is 30.",
  "what-percent": "Turns two numbers into a percentage. 30 out of 250 is 12%.",
  change: "Measures growth or drop between two figures, relative to the first.",
  apply: "Adds a percentage on, or takes it off.",
  reverse:
    "Finds the original before a rise or a discount. A price of 2,800 after 20% off started at 3,500, not 3,360.",
  marks: "Your score as a percentage of the paper.",
};

function SimplePanel({
  mode,
  first,
  second,
  direction,
  onFirst,
  onSecond,
  onDirection,
  result,
}: {
  mode: Exclude<Mode, "weighted">;
  first: string;
  second: string;
  direction: Direction;
  onFirst: (value: string) => void;
  onSecond: (value: string) => void;
  onDirection: (value: Direction) => void;
  result: PercentageResult;
}) {
  const labels = LABELS[mode];
  const needsDirection = mode === "apply" || mode === "reverse";

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm text-pretty">{HINTS[mode]}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <NumberField id="percent-first" label={labels.first} value={first} onChange={onFirst} />
        <NumberField id="percent-second" label={labels.second} value={second} onChange={onSecond} />
      </div>

      {needsDirection ? (
        <div role="group" aria-label="Direction of the change" className="flex gap-2">
          {(["increase", "decrease"] as const).map((option) => (
            <Button
              key={option}
              size="sm"
              variant={direction === option ? "default" : "outline"}
              aria-pressed={direction === option}
              onClick={() => onDirection(option)}
            >
              {option === "increase" ? "Increase" : "Decrease"}
            </Button>
          ))}
        </div>
      ) : null}

      <ResultCard
        result={result}
        unit={mode === "what-percent" || mode === "marks" || mode === "change" ? "%" : ""}
      />
    </div>
  );
}

function NumberField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
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
        step="any"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function ResultCard({ result, unit }: { result: PercentageResult; unit: string }) {
  if (!result.ok) {
    return (
      <div
        className={cn(
          "bg-card ring-foreground/10 rounded-xl p-4 text-sm ring-1",
          result.error.code === "incomplete" ? "text-muted-foreground" : "text-destructive",
        )}
        role={result.error.code === "incomplete" ? undefined : "alert"}
      >
        {result.error.message}
      </div>
    );
  }

  return (
    <div className="bg-card ring-foreground/10 flex flex-col gap-2 rounded-xl p-4 ring-1">
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Answer</p>
      <p
        className="font-display text-primary text-3xl font-semibold tabular-nums"
        aria-live="polite"
      >
        {formatNumber(result.outcome.value)}
        {unit}
      </p>
      <p className="text-muted-foreground font-mono text-xs break-words">
        {result.outcome.formula}
      </p>
      {result.outcome.note ? <p className="text-sm text-pretty">{result.outcome.note}</p> : null}
    </div>
  );
}

function WeightedPanel({
  components,
  onChange,
}: {
  components: WeightedComponent[];
  onChange: (next: WeightedComponent[]) => void;
}) {
  const result = weightedGrade(components);

  function update(id: string, patch: Partial<WeightedComponent>) {
    onChange(components.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm text-pretty">
        Each part of the course scored against its share of the final grade. Leave a row blank until
        you sit it — the result is scored against the weight entered so far, not against a paper you
        have not taken.
      </p>

      <ul className="flex flex-col gap-3">
        {components.map((component, index) => (
          <li key={component.id} className="flex flex-wrap items-center gap-2">
            <Input
              aria-label={`Component ${index + 1} name`}
              placeholder="Part of the course"
              className="h-9 w-full sm:w-auto sm:flex-1"
              value={component.name}
              onChange={(event) => update(component.id, { name: event.target.value })}
            />
            <Input
              aria-label={`Component ${index + 1} marks obtained`}
              placeholder="Got"
              className="h-9 w-[4.5rem] flex-1 sm:flex-none"
              type="number"
              inputMode="decimal"
              step="any"
              value={component.obtained}
              onChange={(event) => update(component.id, { obtained: event.target.value })}
            />
            <Input
              aria-label={`Component ${index + 1} total marks`}
              placeholder="Of"
              className="h-9 w-[4.5rem] flex-1 sm:flex-none"
              type="number"
              inputMode="decimal"
              step="any"
              value={component.total}
              onChange={(event) => update(component.id, { total: event.target.value })}
            />
            <Input
              aria-label={`Component ${index + 1} weight percent`}
              placeholder="Wt %"
              className="h-9 w-[4.5rem] flex-1 sm:flex-none"
              type="number"
              inputMode="decimal"
              step="any"
              value={component.weight}
              onChange={(event) => update(component.id, { weight: event.target.value })}
            />
            <Button
              variant="ghost"
              size="icon"
              className="size-9 shrink-0"
              aria-label={`Remove component ${index + 1}`}
              disabled={components.length <= 1}
              onClick={() => onChange(components.filter((item) => item.id !== component.id))}
            >
              <X className="size-4" aria-hidden />
            </Button>
          </li>
        ))}
      </ul>

      <Button
        variant="ghost"
        size="sm"
        className="w-fit"
        onClick={() => onChange([...components, newComponent()])}
      >
        <Plus className="size-4" aria-hidden />
        Add part
      </Button>

      <div className="bg-card ring-foreground/10 flex flex-col gap-2 rounded-xl p-4 ring-1">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Grade so far
        </p>
        <p
          className="font-display text-primary text-3xl font-semibold tabular-nums"
          aria-live="polite"
        >
          {result.percent === null ? "—" : `${formatNumber(result.percent, 2)}%`}
        </p>
        <p className="text-muted-foreground text-sm">
          {result.percent === null
            ? "Fill in the marks and the weight for at least one part."
            : `Based on ${formatNumber(result.countedWeight)}% of the course.`}
        </p>
        {result.weightsIncomplete ? (
          <p className="text-highlight text-sm text-pretty">
            The weights you have entered do not add up to 100%. That is fine while the course is
            running, but check them before you trust the final figure.
          </p>
        ) : null}
      </div>
    </div>
  );
}
