"use client";

import { AlertTriangle, Check, Trash2, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { draftTimes, entryProblems, type EntryDraft } from "@/lib/timetable/draft";
import { KIND_LABELS, dayName } from "@/lib/timetable/labels";
import { clashesWith, suggestColour } from "@/lib/timetable/schedule";
import { formatRange, type ClockFormat } from "@/lib/timetable/time";
import {
  ALL_DAYS,
  COURSE_COLOURS,
  ENTRY_KINDS,
  type DayIndex,
  type EntryKind,
  type TimetableEntry,
} from "@/lib/timetable/types";

import { courseStyle } from "./course-style";

/**
 * The form for one class. Local state until Save, like the citation form:
 * the grid behind it should not reshuffle on every keystroke.
 */
export function EntryEditor({
  initial,
  editingId,
  entries,
  clock,
  onSubmit,
  onDelete,
  onCancel,
}: {
  initial: EntryDraft;
  /** Set when editing an existing class, so it does not clash with itself. */
  editingId?: string;
  entries: readonly TimetableEntry[];
  clock: ClockFormat;
  onSubmit: (draft: EntryDraft) => void;
  onDelete?: () => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  // Once the student picks a colour, typing a course name no longer changes it.
  const [colourChosen, setColourChosen] = useState(editingId !== undefined);
  const [showProblems, setShowProblems] = useState(false);
  const id = useId();
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    sectionRef.current?.querySelector<HTMLInputElement>("input[name='title']")?.focus({
      preventScroll: true,
    });
  }, []);

  const problems = entryProblems(draft);
  const times = draftTimes(draft);
  const clashes = times
    ? draft.days.flatMap((day) =>
        clashesWith({ day, ...times }, entries, editingId).map((entry) => ({ day, entry })),
      )
    : [];
  const titles = [...new Set(entries.map((entry) => entry.title))].sort();

  function update(patch: Partial<EntryDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function setTitle(title: string) {
    const others = entries.filter((entry) => entry.id !== editingId);
    setDraft((current) => ({
      ...current,
      title,
      colour: colourChosen ? current.colour : suggestColour(others, title),
    }));
  }

  function toggleDay(day: DayIndex) {
    setDraft((current) => ({
      ...current,
      days: current.days.includes(day)
        ? current.days.filter((existing) => existing !== day)
        : [...current.days, day],
    }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (problems.length > 0) {
      setShowProblems(true);
      return;
    }
    onSubmit(draft);
  }

  return (
    <section
      ref={sectionRef}
      aria-labelledby={`${id}-heading`}
      className="bg-card ring-foreground/10 scroll-mt-20 rounded-xl p-4 ring-1 print:hidden"
    >
      <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
        <div className="flex items-center justify-between gap-2">
          <h2 id={`${id}-heading`} className="font-display font-semibold">
            {editingId ? "Edit class" : "New class"}
          </h2>
          <Button type="button" variant="ghost" size="icon" aria-label="Close" onClick={onCancel}>
            <X className="size-4" aria-hidden />
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
          <Field
            id={`${id}-title`}
            label="Course"
            error={
              showProblems && problems.includes("missing-title") ? "Give the class a name." : null
            }
          >
            <Input
              id={`${id}-title`}
              name="title"
              className="h-9"
              list={`${id}-titles`}
              autoComplete="off"
              placeholder="e.g. Linear Algebra"
              value={draft.title}
              aria-invalid={showProblems && problems.includes("missing-title") ? true : undefined}
              onChange={(event) => setTitle(event.target.value)}
            />
            <datalist id={`${id}-titles`}>
              {titles.map((title) => (
                <option key={title} value={title} />
              ))}
            </datalist>
          </Field>

          <Field id={`${id}-kind`} label="Type">
            <NativeSelect
              id={`${id}-kind`}
              className="h-9"
              value={draft.kind}
              onChange={(event) => update({ kind: event.target.value as EntryKind })}
            >
              {ENTRY_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {KIND_LABELS[kind]}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-muted-foreground mb-1.5 text-xs font-medium">
            {editingId ? "Day (pick more to copy this class to them)" : "Days"}
          </legend>
          <div className="grid grid-cols-7 gap-1">
            {ALL_DAYS.map((day) => {
              const on = draft.days.includes(day);
              return (
                <Button
                  key={day}
                  type="button"
                  variant={on ? "default" : "outline"}
                  className="h-9 px-0"
                  aria-pressed={on}
                  aria-label={dayName(day)}
                  onClick={() => toggleDay(day)}
                >
                  {dayName(day, "short").slice(0, 2)}
                </Button>
              );
            })}
          </div>
          {showProblems && problems.includes("no-days") ? (
            <p className="text-destructive text-xs">Pick at least one day.</p>
          ) : null}
        </fieldset>

        <div className="grid grid-cols-2 gap-4">
          <Field id={`${id}-start`} label="Starts">
            <Input
              id={`${id}-start`}
              type="time"
              step={300}
              className="h-9"
              value={draft.start}
              onChange={(event) => update({ start: event.target.value })}
            />
          </Field>
          <Field id={`${id}-end`} label="Ends">
            <Input
              id={`${id}-end`}
              type="time"
              step={300}
              className="h-9"
              value={draft.end}
              aria-invalid={
                showProblems && problems.includes("ends-before-start") ? true : undefined
              }
              onChange={(event) => update({ end: event.target.value })}
            />
          </Field>
          {showProblems &&
          (problems.includes("ends-before-start") || problems.includes("bad-time")) ? (
            <p className="text-destructive col-span-2 -mt-2 text-xs">
              The class has to end after it starts.
            </p>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={`${id}-location`} label="Room">
            <Input
              id={`${id}-location`}
              className="h-9"
              autoComplete="off"
              placeholder="e.g. LT-3"
              value={draft.location}
              onChange={(event) => update({ location: event.target.value })}
            />
          </Field>
          <Field id={`${id}-instructor`} label="Teacher">
            <Input
              id={`${id}-instructor`}
              className="h-9"
              autoComplete="off"
              value={draft.instructor}
              onChange={(event) => update({ instructor: event.target.value })}
            />
          </Field>
        </div>

        <fieldset>
          <legend className="text-muted-foreground mb-1.5 text-xs font-medium">Colour</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Colour">
            {COURSE_COLOURS.map((colour) => {
              const on = draft.colour === colour;
              return (
                <button
                  key={colour}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={`Colour ${colour}`}
                  style={courseStyle(colour)}
                  className="ring-offset-background flex size-9 items-center justify-center rounded-full bg-[var(--entry)] text-[var(--card)] ring-[var(--entry)] ring-offset-2 aria-checked:ring-2"
                  onClick={() => {
                    setColourChosen(true);
                    update({ colour });
                  }}
                >
                  {on ? <Check className="size-4" aria-hidden /> : null}
                </button>
              );
            })}
          </div>
        </fieldset>

        {clashes.length > 0 ? (
          <div role="status" className="text-highlight flex items-start gap-2 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p className="text-pretty">
              Clashes with{" "}
              {clashes
                .map(
                  ({ day, entry }) =>
                    `${entry.title} (${dayName(day)} ${formatRange(entry.start, entry.end, clock)})`,
                )
                .join(", ")}
              . You can still save it.
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button type="submit">{editingId ? "Save changes" : "Add to timetable"}</Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          {onDelete ? (
            <Button type="button" variant="destructive" className="ms-auto" onClick={onDelete}>
              <Trash2 className="size-4" aria-hidden />
              Delete class
            </Button>
          ) : null}
        </div>
      </form>
    </section>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id} className="text-muted-foreground text-xs">
        {label}
      </Label>
      {children}
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}
