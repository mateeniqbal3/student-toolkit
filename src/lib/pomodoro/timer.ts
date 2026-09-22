/**
 * The pomodoro timer as a pure state machine over timestamps.
 *
 * Nothing here counts ticks. A running phase stores the moment it ends, and
 * the time left is always `endsAt - now`, so a tab the browser throttled or a
 * phone that slept shows the right time the instant it wakes. When it wakes
 * after several phases should have ended, `settle` replays them in order from
 * their scheduled end times, not from when the page noticed.
 */

export const SECOND = 1000;
export const MINUTE = 60 * SECOND;

export type Phase = "focus" | "shortBreak" | "longBreak";

export const PHASES: readonly Phase[] = ["focus", "shortBreak", "longBreak"];

export interface PomodoroSettings {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  /** A long break replaces the short one after this many focus sessions. */
  longBreakEvery: number;
  autoStartBreaks: boolean;
  autoStartFocus: boolean;
}

/** The classic 25/5/15 with a long break every fourth session. */
export const DEFAULT_SETTINGS: PomodoroSettings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakEvery: 4,
  autoStartBreaks: false,
  autoStartFocus: false,
};

/** Inclusive bounds for each numeric setting. */
export const SETTING_LIMITS = {
  focusMinutes: { min: 1, max: 120 },
  shortBreakMinutes: { min: 1, max: 60 },
  longBreakMinutes: { min: 1, max: 60 },
  longBreakEvery: { min: 1, max: 12 },
} as const;

/**
 * A started phase remembers the length it was started with, so changing the
 * settings mid-session affects the next phase and never rewrites this one.
 */
export type Run =
  | { kind: "idle" }
  | { kind: "running"; startedAt: number; endsAt: number; lengthMs: number }
  | { kind: "paused"; startedAt: number; remainingMs: number; lengthMs: number };

export interface TimerState {
  phase: Phase;
  /** Focus sessions finished since the last long break. */
  completedInCycle: number;
  run: Run;
}

export const INITIAL_STATE: TimerState = {
  phase: "focus",
  completedInCycle: 0,
  run: { kind: "idle" },
};

/**
 * A stretch of focus that ended, for the history. Breaks are not recorded:
 * the history answers "how much did I study", and breaks are not the answer.
 */
export interface FocusRecord {
  startedAt: number;
  endedAt: number;
  /** Time actually spent focusing, which excludes any pauses. */
  durationMs: number;
  /** False when the student skipped or reset before the time was up. */
  completed: boolean;
}

/** Stopping sooner than this is a mis-tap, not study, so it is not recorded. */
export const MIN_RECORDED_MS = MINUTE;

export function phaseLength(phase: Phase, settings: PomodoroSettings): number {
  const minutes =
    phase === "focus"
      ? settings.focusMinutes
      : phase === "shortBreak"
        ? settings.shortBreakMinutes
        : settings.longBreakMinutes;
  return minutes * MINUTE;
}

export function remainingMs(state: TimerState, settings: PomodoroSettings, now: number): number {
  switch (state.run.kind) {
    case "idle":
      return phaseLength(state.phase, settings);
    case "paused":
      return state.run.remainingMs;
    case "running":
      return Math.max(0, state.run.endsAt - now);
  }
}

/** How much of the current phase has gone, from 0 to 1, for the progress ring. */
export function progress(state: TimerState, settings: PomodoroSettings, now: number): number {
  if (state.run.kind === "idle" || state.run.lengthMs <= 0) return 0;
  const done = 1 - remainingMs(state, settings, now) / state.run.lengthMs;
  return Math.min(1, Math.max(0, done));
}

export function start(state: TimerState, settings: PomodoroSettings, now: number): TimerState {
  const { run } = state;
  if (run.kind === "running") return state;
  if (run.kind === "paused") {
    return {
      ...state,
      run: {
        kind: "running",
        startedAt: run.startedAt,
        endsAt: now + run.remainingMs,
        lengthMs: run.lengthMs,
      },
    };
  }
  const lengthMs = phaseLength(state.phase, settings);
  return { ...state, run: { kind: "running", startedAt: now, endsAt: now + lengthMs, lengthMs } };
}

export function pause(state: TimerState, now: number): TimerState {
  const { run } = state;
  if (run.kind !== "running") return state;
  return {
    ...state,
    run: {
      kind: "paused",
      startedAt: run.startedAt,
      remainingMs: Math.max(0, run.endsAt - now),
      lengthMs: run.lengthMs,
    },
  };
}

/** The phase that follows this one, and the cycle count once it begins. */
export function nextPhase(
  state: Pick<TimerState, "phase" | "completedInCycle">,
  settings: PomodoroSettings,
): { phase: Phase; completedInCycle: number } {
  if (state.phase === "focus") {
    const completed = state.completedInCycle + 1;
    return {
      phase: completed >= settings.longBreakEvery ? "longBreak" : "shortBreak",
      completedInCycle: completed,
    };
  }
  // A long break closes the cycle; a short one leaves the count running.
  return {
    phase: "focus",
    completedInCycle: state.phase === "longBreak" ? 0 : state.completedInCycle,
  };
}

function autoStarts(phase: Phase, settings: PomodoroSettings): boolean {
  return phase === "focus" ? settings.autoStartFocus : settings.autoStartBreaks;
}

export interface Transition {
  state: TimerState;
  /** Focus that ended in this step, oldest first. */
  focus: FocusRecord[];
  /** Phases that ran to their end, oldest first, for the chime and notification. */
  finished: { phase: Phase; endedAt: number }[];
}

/**
 * Moves a running timer on past every phase that has already ended.
 *
 * Each phase that auto-starts begins at the previous phase's scheduled end,
 * so an hour asleep with both auto-starts on lands exactly where an hour
 * awake would have. A phase that does not auto-start waits, idle.
 */
export function settle(state: TimerState, settings: PomodoroSettings, now: number): Transition {
  const focus: FocusRecord[] = [];
  const finished: Transition["finished"] = [];
  let current = state;

  // Bounded, so a clock that jumped years ahead cannot spin: 500 phases is days.
  for (let step = 0; step < 500; step += 1) {
    const { run } = current;
    if (run.kind !== "running" || run.endsAt > now) break;

    if (current.phase === "focus") {
      focus.push({
        startedAt: run.startedAt,
        endedAt: run.endsAt,
        durationMs: run.lengthMs,
        completed: true,
      });
    }
    finished.push({ phase: current.phase, endedAt: run.endsAt });

    const next = nextPhase(current, settings);
    const lengthMs = phaseLength(next.phase, settings);
    current = {
      ...next,
      run: autoStarts(next.phase, settings)
        ? { kind: "running", startedAt: run.endsAt, endsAt: run.endsAt + lengthMs, lengthMs }
        : { kind: "idle" },
    };
  }

  return { state: current, focus, finished };
}

/** Focus cut short is still study, so it is recorded if it lasted a minute. */
function endEarly(state: TimerState, settings: PomodoroSettings, now: number): FocusRecord[] {
  const { run } = state;
  if (state.phase !== "focus" || run.kind === "idle") return [];
  const spent = run.lengthMs - remainingMs(state, settings, now);
  if (spent < MIN_RECORDED_MS) return [];
  return [{ startedAt: run.startedAt, endedAt: now, durationMs: spent, completed: false }];
}

/**
 * Ends the current phase now and readies the next one. Skipped focus does
 * not count as a pomodoro, but the minutes spent on it are kept.
 */
export function skip(state: TimerState, settings: PomodoroSettings, now: number): Transition {
  const settled = settle(state, settings, now);
  if (settled.finished.length > 0) return settled;

  return {
    state: { ...nextPhase(state, settings), run: { kind: "idle" } },
    focus: endEarly(state, settings, now),
    finished: [],
  };
}

/** Back to the start of the current phase, keeping any focus already spent. */
export function reset(state: TimerState, settings: PomodoroSettings, now: number): Transition {
  return selectPhase(state, state.phase, settings, now);
}

/** Jumps to a phase by hand. The cycle count is kept. */
export function selectPhase(
  state: TimerState,
  phase: Phase,
  settings: PomodoroSettings,
  now: number,
): Transition {
  const settled = settle(state, settings, now);
  if (settled.finished.length > 0) {
    return { ...settled, state: { ...settled.state, phase, run: { kind: "idle" } } };
  }
  return {
    state: { ...state, phase, run: { kind: "idle" } },
    focus: endEarly(state, settings, now),
    finished: [],
  };
}

/** "25:00", or "1:05:00" from an hour up. Rounds up, as countdowns do. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / SECOND));
  const hours = Math.floor(total / 3600);
  const minutes = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const seconds = String(total % 60).padStart(2, "0");
  return hours > 0 ? `${hours}:${minutes}:${seconds}` : `${minutes}:${seconds}`;
}

// --- Storage ---------------------------------------------------------------
// The running timer and the settings live in localStorage, so they are read
// back from text that another version, an extension or a person may have
// changed. Anything malformed falls back rather than breaking the page.

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseJson(text: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(text);
    return isRecord(value) ? value : null;
  } catch {
    return null;
  }
}

function clampSetting(key: keyof typeof SETTING_LIMITS, value: unknown): number {
  const { min, max } = SETTING_LIMITS[key];
  if (!finite(value)) return DEFAULT_SETTINGS[key];
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function parseSettings(text: string): PomodoroSettings {
  const value = parseJson(text);
  if (!value) return DEFAULT_SETTINGS;
  return {
    focusMinutes: clampSetting("focusMinutes", value.focusMinutes),
    shortBreakMinutes: clampSetting("shortBreakMinutes", value.shortBreakMinutes),
    longBreakMinutes: clampSetting("longBreakMinutes", value.longBreakMinutes),
    longBreakEvery: clampSetting("longBreakEvery", value.longBreakEvery),
    autoStartBreaks: value.autoStartBreaks === true,
    autoStartFocus: value.autoStartFocus === true,
  };
}

function parseRun(value: unknown): Run | null {
  if (!isRecord(value)) return null;
  if (value.kind === "idle") return { kind: "idle" };
  const { startedAt, lengthMs } = value;
  if (!finite(startedAt) || !finite(lengthMs) || lengthMs <= 0) return null;
  if (value.kind === "running" && finite(value.endsAt)) {
    return { kind: "running", startedAt, endsAt: value.endsAt, lengthMs };
  }
  if (value.kind === "paused" && finite(value.remainingMs)) {
    return {
      kind: "paused",
      startedAt,
      remainingMs: Math.min(lengthMs, Math.max(0, value.remainingMs)),
      lengthMs,
    };
  }
  return null;
}

export function parseTimerState(text: string): TimerState {
  const value = parseJson(text);
  if (!value) return INITIAL_STATE;
  const phase = PHASES.find((candidate) => candidate === value.phase);
  const run = parseRun(value.run);
  if (!phase || !run) return INITIAL_STATE;
  const completed = value.completedInCycle;
  return {
    phase,
    completedInCycle: finite(completed) ? Math.max(0, Math.floor(completed)) : 0,
    run,
  };
}
