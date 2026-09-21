"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Plus, Trash2, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { deleteCustomScale, saveCustomScale } from "@/lib/db/gpa";
import { db } from "@/lib/db/schema";
import { BUILT_IN_SCALES, type GradeDefinition } from "@/lib/gpa/scales";

interface DraftRow {
  id: string;
  letter: string;
  points: string;
  minPercent: string;
}

function toDraft(grades: readonly GradeDefinition[]): DraftRow[] {
  return grades.map((grade) => ({
    id: crypto.randomUUID(),
    letter: grade.letter,
    points: String(grade.points),
    minPercent: String(grade.minPercent),
  }));
}

function emptyRow(): DraftRow {
  return { id: crypto.randomUUID(), letter: "", points: "", minPercent: "" };
}

/**
 * The escape hatch for a university whose scale is not one of the built-ins.
 *
 * It starts from a copy of an existing scale rather than a blank table,
 * because almost every real scale is a near-miss of a common one and retyping
 * eleven rows to change two of them is not a good use of anyone's evening.
 */
export function CustomScaleEditor({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (id: number) => void;
}) {
  const saved = useLiveQuery(() => db.gradingScales.toArray(), []);
  const [editingId, setEditingId] = useState<number | undefined>(undefined);
  const [name, setName] = useState("My university");
  const [rows, setRows] = useState<DraftRow[]>(() => toDraft(BUILT_IN_SCALES[0].grades));
  const [error, setError] = useState<string | null>(null);

  function updateRow(id: string, patch: Partial<DraftRow>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function loadTemplate(scaleId: string) {
    const template = BUILT_IN_SCALES.find((scale) => scale.id === scaleId);
    if (template && template.grades.length > 0) setRows(toDraft(template.grades));
  }

  function loadForEditing(id: number) {
    const record = (saved ?? []).find((candidate) => candidate.id === id);
    if (!record) return;
    setEditingId(record.id);
    setName(record.name);
    setRows(toDraft(record.grades));
    setError(null);
  }

  async function handleSave() {
    const grades: GradeDefinition[] = [];

    for (const row of rows) {
      const letter = row.letter.trim();
      if (letter === "") continue;

      const points = Number(row.points);
      const minPercent = row.minPercent.trim() === "" ? 0 : Number(row.minPercent);

      if (!Number.isFinite(points) || points < 0) {
        setError(`"${letter}" needs a grade point value of zero or more.`);
        return;
      }
      if (!Number.isFinite(minPercent) || minPercent < 0 || minPercent > 100) {
        setError(`"${letter}" needs a minimum mark between 0 and 100.`);
        return;
      }

      grades.push({ letter, points, minPercent });
    }

    if (name.trim() === "") {
      setError("Give the scale a name so you can find it again.");
      return;
    }
    if (grades.length < 2) {
      setError("A scale needs at least two grades.");
      return;
    }
    if (new Set(grades.map((grade) => grade.letter.toLowerCase())).size !== grades.length) {
      setError("Two grades share a letter. Each one has to be distinct.");
      return;
    }

    const id = await saveCustomScale({ id: editingId, name: name.trim(), grades });
    onSaved(id);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] gap-4 overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editingId === undefined ? "New" : "Edit"} grading scale</DialogTitle>
          <DialogDescription>
            Saved in this browser only. Start from a scale close to yours and change what differs.
          </DialogDescription>
        </DialogHeader>

        {saved && saved.length > 0 ? (
          <div className="flex flex-col gap-2">
            <Label className="text-muted-foreground text-xs">Your scales</Label>
            <ul className="flex flex-col gap-1">
              {saved.map((record) => (
                <li key={record.id} className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="justify-start"
                    onClick={() => loadForEditing(record.id)}
                  >
                    {record.name}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ms-auto size-8"
                    aria-label={`Delete ${record.name}`}
                    onClick={() => void deleteCustomScale(record.id)}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="scale-name">Scale name</Label>
          <Input
            id="scale-name"
            className="h-9"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="scale-template">Start from</Label>
          <NativeSelect
            id="scale-template"
            className="h-9"
            defaultValue=""
            onChange={(event) => loadTemplate(event.target.value)}
          >
            <option value="">Pick a scale to copy…</option>
            {BUILT_IN_SCALES.filter((scale) => scale.grades.length > 0).map((scale) => (
              <option key={scale.id} value={scale.id}>
                {scale.name}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="flex flex-col gap-2">
          <div className="text-muted-foreground grid grid-cols-[1fr_1fr_1fr_2.25rem] gap-2 text-xs">
            <span>Grade</span>
            <span>Points</span>
            <span>Min mark %</span>
            <span className="sr-only">Remove</span>
          </div>

          {rows.map((row, index) => (
            <div key={row.id} className="grid grid-cols-[1fr_1fr_1fr_2.25rem] items-center gap-2">
              <Input
                aria-label={`Grade ${index + 1} letter`}
                className="h-8"
                value={row.letter}
                onChange={(event) => updateRow(row.id, { letter: event.target.value })}
              />
              <Input
                aria-label={`Grade ${index + 1} points`}
                className="h-8"
                type="number"
                inputMode="decimal"
                step="any"
                min={0}
                value={row.points}
                onChange={(event) => updateRow(row.id, { points: event.target.value })}
              />
              <Input
                aria-label={`Grade ${index + 1} minimum mark`}
                className="h-8"
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                value={row.minPercent}
                onChange={(event) => updateRow(row.id, { minPercent: event.target.value })}
              />
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={`Remove grade ${index + 1}`}
                onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))}
              >
                <X className="size-4" aria-hidden />
              </Button>
            </div>
          ))}

          <Button
            variant="ghost"
            size="sm"
            className="w-fit"
            onClick={() => setRows((current) => [...current, emptyRow()])}
          >
            <Plus className="size-4" aria-hidden />
            Add grade
          </Button>
        </div>

        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()}>Save scale</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
