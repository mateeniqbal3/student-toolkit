"use client";

import { AlertTriangle, MapPin, UserRound } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { KIND_LABELS, dayName } from "@/lib/timetable/labels";
import { formatRange, type ClockFormat } from "@/lib/timetable/time";
import type { DayIndex, TimetableEntry } from "@/lib/timetable/types";

import { ENTRY_SURFACE, courseStyle } from "./course-style";

/**
 * One day at a time, for phones: the week grid's seven columns would be
 * 40px wide at 360px, too narrow to read a course name. The tabs are a row
 * of large targets at thumb height, and each class is a full-width card.
 *
 * This only ever renders in the browser (the page waits for IndexedDB), so it
 * can open on today without a hydration mismatch.
 */
export function DayView({
  entries,
  days,
  clock,
  clashIds,
  onEdit,
}: {
  entries: readonly TimetableEntry[];
  days: readonly DayIndex[];
  clock: ClockFormat;
  clashIds: ReadonlySet<string>;
  onEdit: (entry: TimetableEntry) => void;
}) {
  const [chosen, setChosen] = useState<DayIndex>(() => ((new Date().getDay() + 6) % 7) as DayIndex);
  // Today may be a day the grid hides (a weekend); fall back to the first shown day.
  const day = days.includes(chosen) ? chosen : (days[0] ?? 0);
  const today = entries
    .filter((entry) => entry.day === day)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  return (
    <section aria-label="Day view" className="flex flex-col gap-3 sm:hidden print:hidden">
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}>
        {days.map((option) => {
          const count = entries.filter((entry) => entry.day === option).length;
          const on = option === day;
          return (
            <Button
              key={option}
              variant={on ? "default" : "outline"}
              className="h-11 flex-col gap-0 px-0 text-xs"
              aria-pressed={on}
              aria-label={`${dayName(option)}, ${count} ${count === 1 ? "class" : "classes"}`}
              onClick={() => setChosen(option)}
            >
              <span className="font-semibold">{dayName(option, "short")}</span>
              <span className={on ? "opacity-80" : "text-muted-foreground"}>{count}</span>
            </Button>
          );
        })}
      </div>

      <h2 className="font-display font-semibold">{dayName(day)}</h2>

      {today.length === 0 ? (
        <p className="text-muted-foreground text-sm">No classes on {dayName(day)}.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {today.map((entry) => {
            const clash = clashIds.has(entry.id);
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  style={courseStyle(entry.colour)}
                  className={`${ENTRY_SURFACE} flex w-full flex-col gap-1 rounded-lg p-3 text-start ${
                    clash ? "ring-destructive ring-2" : ""
                  }`}
                  onClick={() => onEdit(entry)}
                >
                  <span className="text-muted-foreground flex items-center justify-between gap-2 text-xs tabular-nums">
                    {formatRange(entry.start, entry.end, clock)}
                    <span>{KIND_LABELS[entry.kind]}</span>
                  </span>
                  <span className="font-display flex items-start gap-1.5 font-semibold break-words">
                    {clash ? (
                      <AlertTriangle
                        className="text-destructive mt-1 size-3.5 shrink-0"
                        aria-label="Clash"
                      />
                    ) : null}
                    {entry.title}
                  </span>
                  {entry.location || entry.instructor ? (
                    <span className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      {entry.location ? (
                        <span className="flex items-center gap-1">
                          <MapPin className="size-3" aria-hidden />
                          {entry.location}
                        </span>
                      ) : null}
                      {entry.instructor ? (
                        <span className="flex items-center gap-1">
                          <UserRound className="size-3" aria-hidden />
                          {entry.instructor}
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
