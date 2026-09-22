"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useNow } from "@/hooks/use-now";
import { sessionsBetween } from "@/lib/db/pomodoro";
import {
  addDays,
  chartCeiling,
  dayTotal,
  startOfDay,
  startOfWeek,
  weekTotals,
  wholeMinutes,
  type DayTotal,
} from "@/lib/pomodoro/stats";
import { formatDuration } from "@/lib/timetable/time";
import { cn } from "@/lib/utils";

/**
 * Today's focus and a week of it as a bar chart. The chart is one series, so
 * it is one colour; the exact numbers are in each bar's label and in a table
 * for screen readers, because a bar's height is never the only way to read it.
 */
export function FocusStats() {
  const [now] = useNow(60_000);
  const [weeksBack, setWeeksBack] = useState(0);

  const thisWeek = startOfWeek(now);
  const weekStart = addDays(thisWeek, -7 * weeksBack);
  const today = startOfDay(now);
  // One read covers both the chart's week and today, which may be outside it.
  const from = Math.min(weekStart, today);
  const to = Math.max(addDays(weekStart, 7), addDays(today, 1));

  const sessions = useLiveQuery(() => sessionsBetween(from, to), [from, to]);

  return (
    <section aria-labelledby="focus-heading" className="flex min-w-0 flex-col gap-3">
      <h2 id="focus-heading" className="font-display font-semibold">
        Focus time
      </h2>

      {!sessions ? (
        <Skeleton className="h-52 w-full rounded-xl" />
      ) : (
        <>
          <Today total={dayTotal(sessions, now)} />
          <WeekChart
            days={weekTotals(sessions, weekStart)}
            today={today}
            label={weekLabel(weekStart, weeksBack)}
            onPrevious={() => setWeeksBack((weeks) => weeks + 1)}
            onNext={weeksBack > 0 ? () => setWeeksBack((weeks) => weeks - 1) : undefined}
          />
        </>
      )}
    </section>
  );
}

function weekLabel(weekStart: number, weeksBack: number): string {
  if (weeksBack === 0) return "This week";
  if (weeksBack === 1) return "Last week";
  const format = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });
  return `Week of ${format.format(weekStart)}`;
}

function Today({ total }: { total: DayTotal }) {
  return (
    <dl className="grid grid-cols-2 gap-2">
      <div className="bg-card ring-foreground/10 rounded-xl p-3 ring-1">
        <dt className="text-muted-foreground text-xs">Focused today</dt>
        <dd className="font-display text-2xl font-semibold tabular-nums">
          {formatDuration(wholeMinutes(total.focusMs))}
        </dd>
      </div>
      <div className="bg-card ring-foreground/10 rounded-xl p-3 ring-1">
        <dt className="text-muted-foreground text-xs">Pomodoros today</dt>
        <dd className="font-display text-2xl font-semibold tabular-nums">{total.pomodoros}</dd>
      </div>
    </dl>
  );
}

function WeekChart({
  days,
  today,
  label,
  onPrevious,
  onNext,
}: {
  days: DayTotal[];
  today: number;
  label: string;
  onPrevious: () => void;
  onNext: (() => void) | undefined;
}) {
  const minutes = days.map((day) => wholeMinutes(day.focusMs));
  const total = minutes.reduce((sum, value) => sum + value, 0);
  const ceiling = chartCeiling(Math.max(...minutes));
  const weekday = new Intl.DateTimeFormat(undefined, { weekday: "short" });
  const fullDate = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="bg-card ring-foreground/10 flex flex-col gap-3 rounded-xl p-3 ring-1">
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon-sm" aria-label="Previous week" onClick={onPrevious}>
          <ChevronLeft className="size-4" aria-hidden />
        </Button>
        <p className="min-w-0 flex-1 text-center text-sm">
          <span className="font-medium">{label}</span>
          <span className="text-muted-foreground"> · {formatDuration(total)}</span>
        </p>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Next week"
          disabled={!onNext}
          onClick={onNext}
        >
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      </div>

      <div className="flex gap-2" aria-hidden>
        {/* Recessive scale: two gridlines, labelled at the side. */}
        <div className="text-muted-foreground flex h-32 flex-col justify-between text-end text-[0.65rem] tabular-nums">
          <span className="-translate-y-1/2">{scaleLabel(ceiling)}</span>
          <span>{scaleLabel(ceiling / 2)}</span>
          <span className="translate-y-1/2">0</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="relative h-32">
            <div className="border-border absolute inset-x-0 top-0 border-t border-dashed" />
            <div className="border-border absolute inset-x-0 top-1/2 border-t border-dashed" />
            <div className="border-muted-foreground/40 absolute inset-x-0 bottom-0 border-t" />
            <div className="absolute inset-0 flex items-end gap-0.5">
              {days.map((day, index) => {
                const value = minutes[index] ?? 0;
                return (
                  <div
                    key={day.start}
                    className="group relative flex h-full flex-1 items-end justify-center"
                    title={`${fullDate.format(day.start)}: ${formatDuration(value)}`}
                  >
                    <span className="bg-foreground text-background pointer-events-none absolute -top-1 z-10 -translate-y-full rounded px-1.5 py-0.5 text-[0.65rem] whitespace-nowrap opacity-0 transition-opacity group-hover:opacity-100">
                      {formatDuration(value)}
                    </span>
                    {value > 0 ? (
                      <div
                        className={cn(
                          "w-full max-w-7 rounded-t-[4px]",
                          day.start === today ? "bg-primary" : "bg-primary/70",
                        )}
                        style={{ height: `${Math.max(2, (value / ceiling) * 100)}%` }}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex gap-0.5">
            {days.map((day) => (
              <span
                key={day.start}
                className={cn(
                  "flex-1 text-center text-[0.7rem]",
                  day.start === today ? "text-foreground font-semibold" : "text-muted-foreground",
                )}
              >
                {weekday.format(day.start)}
              </span>
            ))}
          </div>
        </div>
      </div>

      <table className="sr-only">
        <caption>Focus time, {label.toLowerCase()}</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Focus time</th>
            <th scope="col">Pomodoros</th>
          </tr>
        </thead>
        <tbody>
          {days.map((day, index) => (
            <tr key={day.start}>
              <th scope="row">{fullDate.format(day.start)}</th>
              <td>{formatDuration(minutes[index] ?? 0)}</td>
              <td>{day.pomodoros}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** "2h", "30m": short enough for the side of a small chart. */
function scaleLabel(minutes: number): string {
  return minutes >= 60 && minutes % 60 === 0 ? `${minutes / 60}h` : `${minutes}m`;
}
