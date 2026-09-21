"use client";

import { CalendarPlus, X } from "lucide-react";
import { useState } from "react";

import { downloadFile, fileSlug } from "@/components/download";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildIcs } from "@/lib/timetable/ics";
import { KIND_LABELS } from "@/lib/timetable/labels";
import {
  addDays,
  compareDates,
  parseDateInput,
  toDateInput,
  todayDate,
} from "@/lib/timetable/time";
import type { DateOnly, TimetableEntry } from "@/lib/timetable/types";

/** A semester is about fifteen or sixteen teaching weeks almost everywhere. */
const DEFAULT_TERM_WEEKS = 16;

/**
 * Exports the week as repeating calendar events. The only thing a calendar
 * needs that a timetable does not have is when the term starts and ends, so
 * that is all this asks for — and it remembers the answer.
 */
export function CalendarExport({
  name,
  entries,
  termStart,
  termEnd,
  onTermChange,
  onClose,
}: {
  name: string;
  entries: readonly TimetableEntry[];
  termStart?: DateOnly;
  termEnd?: DateOnly;
  onTermChange: (term: { termStart: DateOnly; termEnd: DateOnly }) => void;
  onClose: () => void;
}) {
  const [start, setStart] = useState(() => toDateInput(termStart ?? todayDate()));
  const [end, setEnd] = useState(() =>
    toDateInput(termEnd ?? addDays(termStart ?? todayDate(), DEFAULT_TERM_WEEKS * 7 - 1)),
  );

  const parsedStart = parseDateInput(start);
  const parsedEnd = parseDateInput(end);
  const valid = parsedStart && parsedEnd && compareDates(parsedEnd, parsedStart) >= 0;

  function download() {
    if (!parsedStart || !parsedEnd || !valid) return;
    onTermChange({ termStart: parsedStart, termEnd: parsedEnd });
    const ics = buildIcs(entries, {
      calendarName: name,
      termStart: parsedStart,
      termEnd: parsedEnd,
      kindLabel: (kind) => KIND_LABELS[kind],
    });
    downloadFile(`${fileSlug(name, "timetable")}.ics`, ics, "text/calendar;charset=utf-8");
  }

  return (
    <section
      aria-labelledby="calendar-export-heading"
      className="bg-card ring-foreground/10 flex flex-col gap-4 rounded-xl p-4 ring-1 print:hidden"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="calendar-export-heading" className="font-display font-semibold">
          Add to your calendar
        </h2>
        <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose}>
          <X className="size-4" aria-hidden />
        </Button>
      </div>

      <p className="text-muted-foreground text-sm text-pretty">
        Each class becomes a weekly event from the first day of term to the last. In Google
        Calendar, open Settings, then Import &amp; export, and choose the downloaded file. Apple
        Calendar and Outlook open it directly.
      </p>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="term-start" className="text-muted-foreground text-xs">
            First day of term
          </Label>
          <Input
            id="term-start"
            type="date"
            className="h-9"
            value={start}
            onChange={(event) => setStart(event.target.value)}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="term-end" className="text-muted-foreground text-xs">
            Last day of term
          </Label>
          <Input
            id="term-end"
            type="date"
            className="h-9"
            value={end}
            aria-invalid={!valid ? true : undefined}
            onChange={(event) => setEnd(event.target.value)}
          />
        </div>
      </div>
      {!valid ? (
        <p className="text-destructive -mt-2 text-xs">The term has to end after it starts.</p>
      ) : null}

      <Button className="w-fit" disabled={!valid || entries.length === 0} onClick={download}>
        <CalendarPlus className="size-4" aria-hidden />
        Download .ics
      </Button>
    </section>
  );
}
