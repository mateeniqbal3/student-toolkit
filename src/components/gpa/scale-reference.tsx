"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { letterForPercent } from "@/lib/gpa/calculate";
import type { GradingScale } from "@/lib/gpa/scales";

/**
 * The scale written out, plus the conversion students actually need when their
 * university reports marks but their transcript wants letters.
 *
 * Collapsed by default — it is reference material, not a step — and built on
 * `<details>` so it works before hydration and costs nothing to open.
 */
export function ScaleReference({ scale }: { scale: GradingScale }) {
  if (scale.mode === "percentage" || scale.grades.length === 0) return null;

  return (
    <details className="bg-card ring-foreground/10 rounded-xl ring-1">
      <summary className="font-display cursor-pointer list-none p-4 text-sm font-semibold">
        {scale.name} — grades and marks
      </summary>

      <div className="flex flex-col gap-4 px-4 pb-4">
        <MarkConverter scale={scale} />

        <table className="w-full text-sm">
          <caption className="text-muted-foreground mb-2 text-start text-xs">
            Percentage bands are a guide: your university sets the exact boundaries, and grade
            points are what the GPA is built from.
          </caption>
          <thead>
            <tr className="text-muted-foreground text-start text-xs">
              <th scope="col" className="py-1 text-start font-medium">
                Grade
              </th>
              <th scope="col" className="py-1 text-start font-medium">
                Points
              </th>
              <th scope="col" className="py-1 text-start font-medium">
                Marks
              </th>
            </tr>
          </thead>
          <tbody>
            {scale.grades.map((grade, index) => {
              const above = scale.grades[index - 1];
              const upper = above ? above.minPercent - 0.01 : 100;
              return (
                <tr key={grade.letter} className="border-border border-t">
                  <td className="py-1.5 font-medium">{grade.letter}</td>
                  <td className="py-1.5 tabular-nums">{grade.points.toFixed(2)}</td>
                  <td className="text-muted-foreground py-1.5 tabular-nums">
                    {grade.minPercent === 0
                      ? `below ${upper.toFixed(0)}%`
                      : `${grade.minPercent}–${upper.toFixed(0)}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function MarkConverter({ scale }: { scale: GradingScale }) {
  const [marks, setMarks] = useState("");

  const parsed = Number(marks);
  const valid = marks.trim() !== "" && Number.isFinite(parsed) && parsed >= 0 && parsed <= 100;
  const grade = valid ? letterForPercent(scale, parsed) : null;

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="mark-to-grade" className="text-muted-foreground text-xs">
          Marks to grade
        </Label>
        <Input
          id="mark-to-grade"
          className="h-9 w-28"
          type="number"
          inputMode="decimal"
          min={0}
          max={100}
          placeholder="e.g. 78"
          value={marks}
          onChange={(event) => setMarks(event.target.value)}
        />
      </div>

      <p className="pb-1.5 text-sm" aria-live="polite">
        {grade ? (
          <>
            <span className="text-muted-foreground">That is a </span>
            <span className="text-primary font-semibold">{grade.letter}</span>
            <span className="text-muted-foreground">
              {" "}
              — {grade.points.toFixed(2)} points on this scale.
            </span>
          </>
        ) : (
          <span className="text-muted-foreground">Enter marks out of 100.</span>
        )}
      </p>
    </div>
  );
}
