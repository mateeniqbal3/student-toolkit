"use client";

import { AlertTriangle } from "lucide-react";
import type { MouseEvent } from "react";

import { KIND_LABELS, dayName } from "@/lib/timetable/labels";
import { layoutDay } from "@/lib/timetable/schedule";
import { formatRange, formatTime, type ClockFormat } from "@/lib/timetable/time";
import type { DayIndex, TimetableEntry } from "@/lib/timetable/types";

import { ENTRY_SURFACE, courseStyle } from "./course-style";

/** One pixel per minute: an hour is 60px, enough for a title, a time and a room. */
const PX_PER_MINUTE = 1;
/** A click on an empty slot starts a class at the half hour it landed in. */
const SNAP_MINUTES = 30;

/**
 * The week at a glance. Shown from the small breakpoint up, and always when
 * printing — on a phone, seven columns would be too narrow to read, so the
 * phone gets the day view instead.
 */
export function WeekGrid({
  name,
  entries,
  days,
  range,
  clock,
  clashIds,
  onEdit,
  onAddAt,
}: {
  name: string;
  entries: readonly TimetableEntry[];
  days: readonly DayIndex[];
  range: { start: number; end: number };
  clock: ClockFormat;
  clashIds: ReadonlySet<string>;
  onEdit: (entry: TimetableEntry) => void;
  onAddAt: (day: DayIndex, minute: number) => void;
}) {
  const height = (range.end - range.start) * PX_PER_MINUTE;
  const hours: number[] = [];
  for (let minute = range.start; minute < range.end; minute += 60) hours.push(minute);
  const columns = { gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))` };

  function addFromClick(event: MouseEvent<HTMLDivElement>, day: DayIndex) {
    // Only clicks on the empty column, not ones that bubbled up from a class.
    if (event.target !== event.currentTarget) return;
    const offset = event.nativeEvent.offsetY / PX_PER_MINUTE;
    const minute = range.start + Math.floor(offset / SNAP_MINUTES) * SNAP_MINUTES;
    onAddAt(day, Math.min(minute, range.end - SNAP_MINUTES));
  }

  return (
    <section aria-label="Week view" className="hidden flex-col gap-2 sm:flex print:flex">
      <h2 className="font-display hidden text-xl font-semibold print:block">{name}</h2>

      <div className="grid text-xs" style={columns}>
        <div />
        {days.map((day) => (
          <div key={day} className="font-display pb-2 text-center text-sm font-semibold">
            <span className="hidden lg:inline print:inline">{dayName(day)}</span>
            <span className="lg:hidden print:hidden">{dayName(day, "short")}</span>
          </div>
        ))}

        <div className="relative" style={{ height }} aria-hidden>
          {hours.map((minute) => (
            <span
              key={minute}
              className="text-muted-foreground absolute end-2 -translate-y-1/2 tabular-nums"
              style={{ top: (minute - range.start) * PX_PER_MINUTE }}
            >
              {minute === range.start ? "" : formatTime(minute, clock)}
            </span>
          ))}
        </div>

        {days.map((day) => (
          <div
            key={day}
            data-day={day}
            className="print-exact relative cursor-copy border-s border-b bg-[repeating-linear-gradient(to_bottom,var(--border)_0_1px,transparent_1px_60px)] last:border-e print:cursor-auto"
            style={{ height }}
            title="Click an empty slot to add a class"
            onClick={(event) => addFromClick(event, day)}
          >
            {layoutDay(entries.filter((entry) => entry.day === day)).map(
              ({ entry, lane, lanes }) => {
                const clash = clashIds.has(entry.id);
                return (
                  <button
                    key={entry.id}
                    type="button"
                    style={{
                      ...courseStyle(entry.colour),
                      top: (entry.start - range.start) * PX_PER_MINUTE + 1,
                      height: Math.max((entry.end - entry.start) * PX_PER_MINUTE - 2, 18),
                      left: `calc(${(lane / lanes) * 100}% + 2px)`,
                      width: `calc(${100 / lanes}% - 4px)`,
                    }}
                    className={`${ENTRY_SURFACE} absolute flex cursor-pointer flex-col overflow-hidden rounded-md px-1.5 py-1 text-start leading-tight transition-shadow hover:shadow-md ${
                      clash ? "ring-destructive ring-2" : ""
                    }`}
                    aria-label={`${entry.title}, ${KIND_LABELS[entry.kind]}, ${dayName(day)} ${formatRange(entry.start, entry.end, clock)}${entry.location ? `, ${entry.location}` : ""}${clash ? ", clashes with another class" : ""}`}
                    onClick={() => onEdit(entry)}
                  >
                    <span className="flex items-start gap-1 font-semibold">
                      {clash ? (
                        <AlertTriangle
                          className="text-destructive mt-px size-3 shrink-0"
                          aria-hidden
                        />
                      ) : null}
                      {/* A split lane is too narrow to wrap a word cleanly, so it
                          truncates instead of breaking "Physics" into "Physic s". */}
                      <span className={lanes > 1 ? "truncate" : "line-clamp-2 break-words"}>
                        {entry.title}
                      </span>
                    </span>
                    <span className="text-muted-foreground truncate tabular-nums">
                      {formatRange(entry.start, entry.end, clock)}
                    </span>
                    {entry.location ? (
                      <span className="text-muted-foreground truncate">{entry.location}</span>
                    ) : null}
                  </button>
                );
              },
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
