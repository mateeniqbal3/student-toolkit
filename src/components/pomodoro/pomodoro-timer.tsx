"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { db } from "@/lib/db/schema";
import {
  PHASES,
  formatClock,
  progress,
  remainingMs,
  type Phase,
  type TimerState,
} from "@/lib/pomodoro/timer";

import { notify, playChime, unlockAudio } from "./alerts";
import { FocusStats } from "./focus-stats";
import { TaskList } from "./task-list";
import { TimerSettings } from "./timer-settings";
import { usePomodoro } from "./use-pomodoro";

const SOUND_KEY = "toolkit:pomodoro:sound";
const NOTIFY_KEY = "toolkit:pomodoro:notify";

const PHASE_LABELS: Record<Phase, string> = {
  focus: "Focus",
  shortBreak: "Short break",
  longBreak: "Long break",
};

/** What to say when a phase ends, naming what comes next. */
function endMessage(ended: Phase, next: TimerState): { title: string; body: string } {
  if (ended === "focus") {
    return next.phase === "longBreak"
      ? { title: "Focus done — long break", body: "That's a full cycle. Step away properly." }
      : {
          title: "Focus done — short break",
          body: "Stand up, stretch, look at something far away.",
        };
  }
  return { title: "Break over", body: "Ready for the next focus session." };
}

export function PomodoroTimer() {
  const [sound, setSound] = useLocalStorage(SOUND_KEY, "on");
  const [notifications, setNotifications] = useLocalStorage(NOTIFY_KEY, "off");
  const [announcement, setAnnouncement] = useState("");

  const onPhaseEnd = useCallback(
    (ended: Phase, next: TimerState) => {
      const message = endMessage(ended, next);
      setAnnouncement(`${message.title}.`);
      if (sound === "on") playChime();
      // A notification is for when the page is out of sight; on screen the
      // chime and the changed timer are enough.
      if (notifications === "on" && document.visibilityState === "hidden") {
        void notify(message.title, message.body);
      }
    },
    [sound, notifications],
  );

  const timer = usePomodoro(onPhaseEnd);
  const { state, settings, now } = timer;

  const tasks = useLiveQuery(
    () => db.tasks.toArray().then((rows) => rows.sort((a, b) => a.createdAt - b.createdAt)),
    [],
  );
  const openTasks = (tasks ?? []).filter((task) => task.doneAt === null);
  const currentTask = openTasks.find((task) => task.id === timer.taskId);

  const left = remainingMs(state, settings, now);
  const running = state.run.kind === "running";
  const started = state.run.kind !== "idle";

  function toggle() {
    if (running) {
      timer.pause();
      return;
    }
    if (sound === "on") unlockAudio();
    timer.start();
  }

  // The countdown in the tab title, so it can be read from another tab.
  const title = started ? `${formatClock(left)} · ${PHASE_LABELS[state.phase]}` : null;
  useEffect(() => {
    if (!title) return;
    const original = document.title;
    document.title = title;
    return () => {
      document.title = original;
    };
  }, [title]);

  // Space starts and pauses, unless the student is typing or on a control.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== " " || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("button, a, input, textarea, select, summary, [contenteditable]")) return;
      event.preventDefault();
      toggle();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const inCycle =
    state.phase === "focus"
      ? Math.min(state.completedInCycle + 1, settings.longBreakEvery)
      : state.completedInCycle;

  return (
    <div className="flex flex-col gap-6">
      <section
        aria-label="Timer"
        className="bg-card ring-foreground/10 flex flex-col items-center gap-5 rounded-2xl p-5 ring-1 sm:p-8"
      >
        <div
          role="group"
          aria-label="Phase"
          className="bg-muted grid w-full max-w-sm grid-cols-3 gap-1 rounded-lg p-1"
        >
          {PHASES.map((phase) => (
            <button
              key={phase}
              type="button"
              aria-pressed={state.phase === phase}
              className="aria-pressed:bg-background aria-pressed:text-foreground text-muted-foreground rounded-md px-2 py-1.5 text-sm font-medium transition-colors aria-pressed:shadow-sm"
              onClick={() => {
                if (phase === state.phase && !started) return;
                if (
                  started &&
                  !window.confirm(`Stop this ${PHASE_LABELS[state.phase].toLowerCase()}?`)
                ) {
                  return;
                }
                timer.selectPhase(phase);
              }}
            >
              {PHASE_LABELS[phase]}
            </button>
          ))}
        </div>

        <Dial fraction={progress(state, settings, now)}>
          <span
            role="timer"
            aria-label={`${PHASE_LABELS[state.phase]}, ${formatClock(left)} left`}
            className="font-display text-6xl font-semibold tracking-tight tabular-nums sm:text-7xl"
          >
            {formatClock(left)}
          </span>
          <span className="text-muted-foreground mt-1 text-sm">
            {state.run.kind === "paused" ? "Paused" : PHASE_LABELS[state.phase]}
          </span>
        </Dial>

        <CycleDots
          total={settings.longBreakEvery}
          done={state.completedInCycle}
          current={inCycle}
        />

        <div className="flex w-full max-w-sm items-center justify-center gap-3">
          <Button
            variant="outline"
            size="icon-lg"
            className="size-12 rounded-full"
            aria-label="Reset"
            title="Reset"
            disabled={!started}
            onClick={timer.reset}
          >
            <RotateCcw className="size-5" aria-hidden />
          </Button>
          <Button
            className="h-14 flex-1 rounded-full text-base"
            aria-keyshortcuts="Space"
            onClick={toggle}
          >
            {running ? (
              <>
                <Pause className="size-5" aria-hidden />
                Pause
              </>
            ) : (
              <>
                <Play className="size-5" aria-hidden />
                {state.run.kind === "paused" ? "Resume" : "Start"}
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="icon-lg"
            className="size-12 rounded-full"
            aria-label={state.phase === "focus" ? "Skip to break" : "Skip break"}
            title={state.phase === "focus" ? "Skip to break" : "Skip break"}
            onClick={timer.skip}
          >
            <SkipForward className="size-5" aria-hidden />
          </Button>
        </div>

        <div className="flex w-full max-w-sm flex-col gap-1.5">
          <Label htmlFor="current-task" className="text-muted-foreground text-xs">
            Working on
          </Label>
          <NativeSelect
            id="current-task"
            className="h-9"
            value={currentTask ? String(currentTask.id) : ""}
            onChange={(event) => {
              const id = Number.parseInt(event.target.value, 10);
              timer.setTaskId(Number.isSafeInteger(id) ? id : null);
            }}
          >
            <option value="">Nothing in particular</option>
            {openTasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.title}
              </option>
            ))}
          </NativeSelect>
        </div>

        <p role="status" className="sr-only">
          {announcement}
        </p>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <TaskList
          tasks={tasks}
          currentId={currentTask?.id ?? null}
          onSelect={(id) => timer.setTaskId(id)}
        />
        <FocusStats />
      </div>

      <TimerSettings
        settings={settings}
        onChange={timer.setSettings}
        sound={sound === "on"}
        onSoundChange={(on) => setSound(on ? "on" : "off")}
        notifications={notifications === "on"}
        onNotificationsChange={(on) => setNotifications(on ? "on" : "off")}
      />
    </div>
  );
}

/** A ring that fills as the phase runs. */
function Dial({ fraction, children }: { fraction: number; children: ReactNode }) {
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="relative flex aspect-square w-full max-w-72 items-center justify-center">
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={radius} fill="none" strokeWidth="3" className="stroke-muted" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          className="stroke-primary transition-[stroke-dashoffset] duration-300 ease-linear"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
        />
      </svg>
      <div className="relative flex flex-col items-center">{children}</div>
    </div>
  );
}

/** Where the student is in the cycle towards a long break. */
function CycleDots({ total, done, current }: { total: number; done: number; current: number }) {
  return (
    <p className="text-muted-foreground flex items-center gap-2 text-sm">
      <span className="flex gap-1.5" aria-hidden>
        {Array.from({ length: total }, (_, index) => (
          <span
            key={index}
            className={
              index < done
                ? "bg-primary size-2.5 rounded-full"
                : "ring-muted-foreground/40 size-2.5 rounded-full ring-1 ring-inset"
            }
          />
        ))}
      </span>
      <span>
        Pomodoro {Math.max(1, current)} of {total}
      </span>
    </p>
  );
}
