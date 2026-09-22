"use client";

import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";

import { useLocalStorage } from "@/hooks/use-local-storage";
import { recordFocus } from "@/lib/db/pomodoro";
import {
  pause as pauseTimer,
  parseSettings,
  parseTimerState,
  reset as resetTimer,
  selectPhase as selectTimerPhase,
  settle,
  skip as skipTimer,
  start as startTimer,
  type Phase,
  type PomodoroSettings,
  type TimerState,
  type Transition,
} from "@/lib/pomodoro/timer";

const STATE_KEY = "toolkit:pomodoro:timer";
const SETTINGS_KEY = "toolkit:pomodoro:settings";
const TASK_KEY = "toolkit:pomodoro:task";

/**
 * A phase that ended longer ago than this — the tab was closed through it —
 * is recorded quietly on the next visit rather than chimed about.
 */
const ALERT_WINDOW_MS = 60_000;

/** How often the display refreshes while running. The time itself comes from the clock. */
const TICK_MS = 250;

export interface Pomodoro {
  state: TimerState;
  settings: PomodoroSettings;
  now: number;
  taskId: number | null;
  setTaskId: (id: number | null) => void;
  setSettings: (settings: PomodoroSettings) => void;
  start: () => void;
  pause: () => void;
  reset: () => void;
  skip: () => void;
  selectPhase: (phase: Phase) => void;
}

/**
 * The timer's state lives in localStorage rather than in React: a reload, a
 * closed tab or a phone that killed the browser picks up exactly where it
 * was, and a second tab shows the same timer.
 */
export function usePomodoro(onPhaseEnd: (ended: Phase, next: TimerState) => void): Pomodoro {
  const [stateText, setStateText] = useLocalStorage(STATE_KEY, "");
  const [settingsText, setSettingsText] = useLocalStorage(SETTINGS_KEY, "");
  const [taskText, setTaskText] = useLocalStorage(TASK_KEY, "");

  const state = useMemo(() => parseTimerState(stateText), [stateText]);
  const settings = useMemo(() => parseSettings(settingsText), [settingsText]);
  const parsedTask = Number.parseInt(taskText, 10);
  const taskId = Number.isSafeInteger(parsedTask) ? parsedTask : null;

  const [now, setNow] = useState(() => Date.now());
  // The newest phase end already acted on, so a tick that lands before the
  // re-render cannot chime or save twice.
  const handled = useRef(0);

  const apply = useCallback(
    async (transition: Transition) => {
      const last = transition.finished.at(-1);
      const fresh = last !== undefined && last.endedAt > handled.current;
      if (fresh) handled.current = last.endedAt;

      // Saved before the timer moves on. If the page closes in between, the
      // next visit settles the same phase again and the save is skipped as a
      // duplicate; the other order would move on and lose the session.
      try {
        await recordFocus(transition.focus, taskId);
      } catch {
        // Storage refused (private mode, quota): the timer still has to work.
      }
      setStateText(JSON.stringify(transition.state));
      setNow(Date.now());

      if (fresh && Date.now() - last.endedAt < ALERT_WINDOW_MS) {
        onPhaseEnd(last.phase, transition.state);
      }
    },
    [setStateText, taskId, onPhaseEnd],
  );

  const tick = useEffectEvent(() => {
    const time = Date.now();
    setNow(time);
    const settled = settle(state, settings, time);
    if (settled.finished.length > 0) void apply(settled);
  });

  const running = state.run.kind === "running";
  useEffect(() => {
    if (!running) return;
    // Straight away as well as on the interval, so a timer that ended while
    // the page was closed settles on arrival.
    const first = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, TICK_MS);
    // Background tabs have their intervals throttled; catch up the moment
    // the page is looked at again.
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [running]);

  return {
    state,
    settings,
    now,
    taskId,
    setTaskId: (id) => setTaskText(id === null ? "" : String(id)),
    setSettings: (next) => setSettingsText(JSON.stringify(next)),
    start: () => {
      const time = Date.now();
      setStateText(JSON.stringify(startTimer(state, settings, time)));
      setNow(time);
    },
    pause: () => {
      const time = Date.now();
      setStateText(JSON.stringify(pauseTimer(state, time)));
      setNow(time);
    },
    reset: () => void apply(resetTimer(state, settings, Date.now())),
    skip: () => void apply(skipTimer(state, settings, Date.now())),
    selectPhase: (phase) => void apply(selectTimerPhase(state, phase, settings, Date.now())),
  };
}
