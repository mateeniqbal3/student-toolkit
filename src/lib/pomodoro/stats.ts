/**
 * Focus history summed into the numbers the page shows: today, and a week
 * of daily totals for the chart.
 *
 * Days are local calendar days, and weeks start on Monday (ISO 8601, and the
 * convention in Pakistan). A session is counted on the day it started, so a
 * pomodoro begun at 23:50 belongs to the evening it was part of.
 */
import { MINUTE } from "./timer";

export interface SessionLike {
  startedAt: number;
  durationMs: number;
  completed: boolean;
}

export interface DayTotal {
  /** Local midnight at the start of the day. */
  start: number;
  focusMs: number;
  /** Pomodoros that ran their full length. */
  pomodoros: number;
}

export function startOfDay(time: number): number {
  const date = new Date(time);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * Local midnight at the start of the Monday of this time's week. Built from
 * calendar fields rather than by subtracting milliseconds, so a daylight
 * saving change inside the week cannot shift it by an hour.
 */
export function startOfWeek(time: number): number {
  const date = new Date(time);
  const sinceMonday = (date.getDay() + 6) % 7;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - sinceMonday).getTime();
}

/** Midnight `days` calendar days after `dayStart`, which must itself be a midnight. */
export function addDays(dayStart: number, days: number): number {
  const date = new Date(dayStart);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days).getTime();
}

function totalFor(sessions: readonly SessionLike[], from: number, to: number): DayTotal {
  let focusMs = 0;
  let pomodoros = 0;
  for (const session of sessions) {
    if (session.startedAt < from || session.startedAt >= to) continue;
    focusMs += session.durationMs;
    if (session.completed) pomodoros += 1;
  }
  return { start: from, focusMs, pomodoros };
}

export function dayTotal(sessions: readonly SessionLike[], time: number): DayTotal {
  const from = startOfDay(time);
  return totalFor(sessions, from, addDays(from, 1));
}

/** Seven totals, Monday first, for the week starting at `weekStart`. */
export function weekTotals(sessions: readonly SessionLike[], weekStart: number): DayTotal[] {
  return Array.from({ length: 7 }, (_, index) => {
    const from = addDays(weekStart, index);
    return totalFor(sessions, from, addDays(from, 1));
  });
}

/** Whole minutes, rounded down: a 59-second stretch has not earned a minute. */
export function wholeMinutes(ms: number): number {
  return Math.floor(ms / MINUTE);
}

/**
 * The top of the chart's scale: the smallest "nice" number of minutes at or
 * above the busiest day, so gridlines land on round values.
 */
export function chartCeiling(maxMinutes: number): number {
  const steps = [30, 60, 120, 180, 240, 360, 480, 600, 720, 960, 1440];
  return steps.find((step) => step >= maxMinutes) ?? Math.ceil(maxMinutes / 60) * 60;
}
