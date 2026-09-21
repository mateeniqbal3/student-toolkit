"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { AlertTriangle, CalendarPlus, ImageDown, Plus, Printer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { CollectionPicker } from "@/components/collection-picker";
import { fileSlug } from "@/components/download";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { db } from "@/lib/db/schema";
import {
  addEntries,
  addTimetable,
  deleteTimetable,
  duplicateTimetable,
  ensureFirstTimetable,
  removeEntry,
  renameTimetable,
  updateEntry,
  updateSettings,
  type TimetableRecord,
} from "@/lib/db/timetables";
import {
  draftFromEntry,
  entriesFromDraft,
  newEntryDraft,
  type EntryDraft,
} from "@/lib/timetable/draft";
import { dayName } from "@/lib/timetable/labels";
import {
  clashingIds,
  findClashes,
  suggestColour,
  visibleRange,
  weeklyMinutes,
} from "@/lib/timetable/schedule";
import { formatDuration, formatRange, formatTime, type ClockFormat } from "@/lib/timetable/time";
import { ALL_DAYS, type DayIndex, type TimetableEntry } from "@/lib/timetable/types";

import { CalendarExport } from "./calendar-export";
import { DayView } from "./day-view";
import { EntryEditor } from "./entry-editor";
import { exportTimetablePng } from "./export-png";
import { WeekGrid } from "./week-grid";

const SELECTED_STORAGE_KEY = "toolkit:timetable:selected";
const CLOCK_STORAGE_KEY = "toolkit:timetable:clock";
const FIRST_TIMETABLE_NAME = "My timetable";

type EditorState =
  | { mode: "new"; key: string; draft: EntryDraft }
  | { mode: "edit"; key: string; entry: TimetableEntry };

export function TimetableMaker() {
  const [storedId, setStoredId] = useLocalStorage(SELECTED_STORAGE_KEY, "");
  const [clockSetting, setClock] = useLocalStorage(CLOCK_STORAGE_KEY, "12h");
  const clock: ClockFormat = clockSetting === "24h" ? "24h" : "12h";

  const [editor, setEditor] = useState<EditorState | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [removed, setRemoved] = useState<TimetableEntry | null>(null);

  const timetables = useLiveQuery(
    () => db.timetables.toArray().then((rows) => rows.sort((a, b) => a.createdAt - b.createdAt)),
    [],
  );
  const timetable = timetables?.find((row) => String(row.id) === storedId) ?? timetables?.[0];

  const entries = useMemo(() => timetable?.entries ?? [], [timetable]);
  const clashes = useMemo(() => findClashes(entries), [entries]);
  const clashIds = useMemo(() => clashingIds(clashes), [clashes]);

  useEffect(() => {
    void ensureFirstTimetable(FIRST_TIMETABLE_NAME);
  }, []);

  useEffect(() => {
    if (!removed) return;
    const timer = window.setTimeout(() => setRemoved(null), 10_000);
    return () => window.clearTimeout(timer);
  }, [removed]);

  if (!timetables || !timetable) return <LoadingState />;

  const { settings } = timetable;
  // Days with classes stay visible even if hidden in settings, so nothing disappears.
  const days = ALL_DAYS.filter(
    (day) => settings.days.includes(day) || entries.some((entry) => entry.day === day),
  );
  const range = visibleRange(entries, settings.startMinute, settings.endMinute);
  const id = timetable.id;

  function select(next: number) {
    setStoredId(String(next));
    setEditor(null);
    setCalendarOpen(false);
  }

  function startNew(day: DayIndex = days[0] ?? 0, minute = settings.startMinute) {
    setCalendarOpen(false);
    setEditor({
      mode: "new",
      key: crypto.randomUUID(),
      draft: newEntryDraft(day, minute, suggestColour(entries, "")),
    });
  }

  async function save(draft: EntryDraft) {
    if (!editor) return;
    if (editor.mode === "edit") {
      const [first, ...extra] = entriesFromDraft(draft, editor.entry.id);
      if (first) await updateEntry(id, first);
      if (extra.length > 0) await addEntries(id, extra);
    } else {
      await addEntries(id, entriesFromDraft(draft));
    }
    setEditor(null);
  }

  async function remove(entry: TimetableEntry) {
    const gone = await removeEntry(id, entry.id);
    if (gone) setRemoved(gone);
    setEditor(null);
  }

  async function exportPng() {
    await exportTimetablePng(
      {
        title: timetable?.name ?? FIRST_TIMETABLE_NAME,
        entries,
        days,
        dayLabel: (day) => dayName(day),
        range,
        clock,
        clashIds,
      },
      `${fileSlug(timetable?.name ?? "", "timetable")}.png`,
    );
  }

  return (
    // The named print page is set here, on the tool's root, rather than on the
    // grid: a page change forces a break, and setting it lower left the hidden
    // controls above the grid on a blank page of their own.
    <div className="print-timetable flex flex-col gap-6">
      <div className="print:hidden">
        <CollectionPicker
          label="Timetable"
          noun="timetable"
          items={timetables}
          selectedId={id}
          onSelect={select}
          onRename={(name) => void renameTimetable(id, name)}
          onCreate={async () => select(await addTimetable(`Timetable ${timetables.length + 1}`))}
          onDuplicate={async () => {
            const copy = await duplicateTimetable(id, `${timetable.name} (copy)`);
            if (copy !== undefined) select(copy);
          }}
          onDelete={async () => {
            const count = entries.length;
            const detail = count === 1 ? "its 1 class" : `its ${count} classes`;
            if (
              !window.confirm(`Delete “${timetable.name}” and ${detail}? This cannot be undone.`)
            ) {
              return;
            }
            select(await deleteTimetable(id, FIRST_TIMETABLE_NAME));
          }}
        />
      </div>

      <section aria-label="Timetable actions" className="flex flex-col gap-3 print:hidden">
        <p className="text-muted-foreground text-sm" aria-live="polite">
          {entries.length === 0
            ? "No classes yet."
            : `${entries.length} ${entries.length === 1 ? "class" : "classes"} · ${formatDuration(weeklyMinutes(entries))} a week`}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => startNew()}>
            <Plus className="size-4" aria-hidden />
            Add class
          </Button>
          <Button
            variant="outline"
            disabled={entries.length === 0}
            onClick={() => void exportPng()}
          >
            <ImageDown className="size-4" aria-hidden />
            Image
          </Button>
          <Button variant="outline" disabled={entries.length === 0} onClick={() => window.print()}>
            <Printer className="size-4" aria-hidden />
            Print or PDF
          </Button>
          <Button
            variant="outline"
            disabled={entries.length === 0}
            aria-expanded={calendarOpen}
            onClick={() => {
              setEditor(null);
              setCalendarOpen((open) => !open);
            }}
          >
            <CalendarPlus className="size-4" aria-hidden />
            Calendar
          </Button>
        </div>
      </section>

      {clashes.length > 0 ? (
        <section
          aria-label="Clashes"
          className="border-destructive/40 bg-destructive/5 flex flex-col gap-2 rounded-lg border p-3 text-sm print:hidden"
        >
          <p className="text-destructive flex items-center gap-2 font-semibold">
            <AlertTriangle className="size-4" aria-hidden />
            {clashes.length === 1 ? "1 clash" : `${clashes.length} clashes`}
          </p>
          <ul className="flex flex-col gap-1">
            {clashes.map((clash) => (
              <li key={`${clash.a.id}-${clash.b.id}`} className="text-pretty">
                <strong className="font-semibold">{clash.a.title}</strong> and{" "}
                <strong className="font-semibold">{clash.b.title}</strong> overlap on{" "}
                {dayName(clash.day)}, {formatRange(clash.start, clash.end, clock)}.
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {editor ? (
        <EntryEditor
          key={editor.key}
          initial={editor.mode === "edit" ? draftFromEntry(editor.entry) : editor.draft}
          editingId={editor.mode === "edit" ? editor.entry.id : undefined}
          entries={entries}
          clock={clock}
          onSubmit={(draft) => void save(draft)}
          onDelete={editor.mode === "edit" ? () => void remove(editor.entry) : undefined}
          onCancel={() => setEditor(null)}
        />
      ) : null}

      {calendarOpen ? (
        <CalendarExport
          name={timetable.name}
          entries={entries}
          termStart={settings.termStart}
          termEnd={settings.termEnd}
          onTermChange={(term) => void updateSettings(id, term)}
          onClose={() => setCalendarOpen(false)}
        />
      ) : null}

      {removed ? (
        <div
          role="status"
          className="bg-muted flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-sm print:hidden"
        >
          <span className="min-w-0 flex-1 truncate">
            Deleted {removed.title} on {dayName(removed.day)}.
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void addEntries(id, [removed]);
              setRemoved(null);
            }}
          >
            Undo
          </Button>
        </div>
      ) : null}

      <DayView
        entries={entries}
        days={days}
        clock={clock}
        clashIds={clashIds}
        onEdit={(entry) => setEditor({ mode: "edit", key: crypto.randomUUID(), entry })}
      />

      <WeekGrid
        name={timetable.name}
        entries={entries}
        days={days}
        range={range}
        clock={clock}
        clashIds={clashIds}
        onEdit={(entry) => setEditor({ mode: "edit", key: crypto.randomUUID(), entry })}
        onAddAt={startNew}
      />

      <GridSettings timetable={timetable} clock={clock} onClockChange={setClock} />
    </div>
  );
}

const HOURS = Array.from({ length: 25 }, (_, hour) => hour);

function GridSettings({
  timetable,
  clock,
  onClockChange,
}: {
  timetable: TimetableRecord;
  clock: ClockFormat;
  onClockChange: (clock: ClockFormat) => void;
}) {
  const { settings } = timetable;
  const hourLabel = (hour: number) => formatTime(hour * 60, clock);

  function toggleDay(day: DayIndex) {
    const on = settings.days.includes(day);
    // Keep at least one day, or the grid has nothing to draw.
    if (on && settings.days.length === 1) return;
    const next = on
      ? settings.days.filter((existing) => existing !== day)
      : [...settings.days, day];
    void updateSettings(timetable.id, { days: next.sort((a, b) => a - b) });
  }

  return (
    <details className="group rounded-lg border print:hidden">
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium select-none">
        Grid settings
      </summary>
      <div className="flex flex-col gap-4 border-t p-3">
        <fieldset>
          <legend className="text-muted-foreground mb-1.5 text-xs font-medium">Days shown</legend>
          <div className="grid grid-cols-7 gap-1">
            {ALL_DAYS.map((day) => {
              const on = settings.days.includes(day);
              return (
                <Button
                  key={day}
                  variant={on ? "secondary" : "ghost"}
                  className="h-9 px-0"
                  aria-pressed={on}
                  aria-label={`Show ${dayName(day)}`}
                  onClick={() => toggleDay(day)}
                >
                  {dayName(day, "short").slice(0, 2)}
                </Button>
              );
            })}
          </div>
        </fieldset>

        <div className="grid grid-cols-3 gap-3">
          <HourSelect
            id="grid-from"
            label="From"
            value={settings.startMinute / 60}
            options={HOURS.slice(0, 24).filter((hour) => hour * 60 < settings.endMinute)}
            format={hourLabel}
            onChange={(hour) => void updateSettings(timetable.id, { startMinute: hour * 60 })}
          />
          <HourSelect
            id="grid-to"
            label="To"
            value={settings.endMinute / 60}
            options={HOURS.slice(1).filter((hour) => hour * 60 > settings.startMinute)}
            format={hourLabel}
            onChange={(hour) => void updateSettings(timetable.id, { endMinute: hour * 60 })}
          />
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor="grid-clock" className="text-muted-foreground text-xs">
              Clock
            </Label>
            <NativeSelect
              id="grid-clock"
              className="h-9"
              value={clock}
              onChange={(event) => onClockChange(event.target.value === "24h" ? "24h" : "12h")}
            >
              <option value="12h">12-hour</option>
              <option value="24h">24-hour</option>
            </NativeSelect>
          </div>
        </div>
        <p className="text-muted-foreground text-xs text-pretty">
          Classes outside these hours or on hidden days still show; the grid stretches to fit them.
        </p>
      </div>
    </details>
  );
}

function HourSelect({
  id,
  label,
  value,
  options,
  format,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  options: number[];
  format: (hour: number) => string;
  onChange: (hour: number) => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id} className="text-muted-foreground text-xs">
        {label}
      </Label>
      <NativeSelect
        id={id}
        className="h-9"
        value={String(value)}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {options.map((hour) => (
          <option key={hour} value={String(hour)}>
            {format(hour)}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading your saved timetables</span>
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-96 w-full rounded-xl" />
    </div>
  );
}
