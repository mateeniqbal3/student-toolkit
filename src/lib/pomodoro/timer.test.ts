import { describe, expect, it } from "vitest";

import {
  DEFAULT_SETTINGS,
  INITIAL_STATE,
  MINUTE,
  formatClock,
  nextPhase,
  parseSettings,
  parseTimerState,
  pause,
  progress,
  remainingMs,
  reset,
  selectPhase,
  settle,
  skip,
  start,
  type PomodoroSettings,
  type TimerState,
} from "./timer";

const T0 = new Date(2026, 8, 22, 9, 0, 0).getTime();
const S = DEFAULT_SETTINGS;
const AUTO: PomodoroSettings = { ...S, autoStartBreaks: true, autoStartFocus: true };

describe("running the timer", () => {
  it("shows the full phase length before it starts", () => {
    expect(remainingMs(INITIAL_STATE, S, T0)).toBe(25 * MINUTE);
  });

  it("counts down from timestamps, whatever happened in between", () => {
    const running = start(INITIAL_STATE, S, T0);
    // No ticks between these: the answer comes from the clock alone.
    expect(remainingMs(running, S, T0 + 10 * MINUTE + 1)).toBe(15 * MINUTE - 1);
    expect(progress(running, S, T0 + 5 * MINUTE)).toBeCloseTo(0.2);
  });

  it("pauses and resumes without losing or gaining time", () => {
    const running = start(INITIAL_STATE, S, T0);
    const paused = pause(running, T0 + 10 * MINUTE);
    expect(remainingMs(paused, S, T0 + 60 * MINUTE)).toBe(15 * MINUTE);

    const resumed = start(paused, S, T0 + 60 * MINUTE);
    expect(resumed.run).toMatchObject({ kind: "running", startedAt: T0, endsAt: T0 + 75 * MINUTE });
  });

  it("keeps a started phase's length when the settings change", () => {
    const running = start(INITIAL_STATE, S, T0);
    const shorter = { ...S, focusMinutes: 10 };
    expect(remainingMs(running, shorter, T0 + MINUTE)).toBe(24 * MINUTE);
    expect(settle(running, shorter, T0 + 20 * MINUTE).finished).toEqual([]);
  });
});

describe("nextPhase", () => {
  it("follows focus with a short break, and every fourth with a long one", () => {
    expect(nextPhase({ phase: "focus", completedInCycle: 0 }, S)).toEqual({
      phase: "shortBreak",
      completedInCycle: 1,
    });
    expect(nextPhase({ phase: "focus", completedInCycle: 3 }, S)).toEqual({
      phase: "longBreak",
      completedInCycle: 4,
    });
  });

  it("starts a new cycle after a long break only", () => {
    expect(nextPhase({ phase: "shortBreak", completedInCycle: 2 }, S)).toEqual({
      phase: "focus",
      completedInCycle: 2,
    });
    expect(nextPhase({ phase: "longBreak", completedInCycle: 4 }, S)).toEqual({
      phase: "focus",
      completedInCycle: 0,
    });
  });
});

describe("settle", () => {
  it("does nothing before the phase ends", () => {
    const running = start(INITIAL_STATE, S, T0);
    const result = settle(running, S, T0 + 25 * MINUTE - 1);
    expect(result.state).toBe(running);
    expect(result.focus).toEqual([]);
  });

  it("records a finished focus session and waits at the break", () => {
    const running = start(INITIAL_STATE, S, T0);
    const result = settle(running, S, T0 + 30 * MINUTE);
    expect(result.focus).toEqual([
      { startedAt: T0, endedAt: T0 + 25 * MINUTE, durationMs: 25 * MINUTE, completed: true },
    ]);
    expect(result.state).toEqual({
      phase: "shortBreak",
      completedInCycle: 1,
      run: { kind: "idle" },
    });
  });

  it("records only focus time when pauses stretched the session", () => {
    const paused = pause(start(INITIAL_STATE, S, T0), T0 + 5 * MINUTE);
    const resumed = start(paused, S, T0 + 65 * MINUTE);
    const result = settle(resumed, S, T0 + 90 * MINUTE);
    expect(result.focus[0]).toMatchObject({ startedAt: T0, durationMs: 25 * MINUTE });
  });

  it("replays phases that ended while the phone slept, from their scheduled ends", () => {
    const running = start(INITIAL_STATE, AUTO, T0);
    // Focus 25, break 5, focus 25, break 5, then 10 minutes into the third focus.
    const result = settle(running, AUTO, T0 + 70 * MINUTE);
    expect(result.focus.map((record) => record.startedAt)).toEqual([T0, T0 + 30 * MINUTE]);
    expect(result.finished.map((phase) => phase.phase)).toEqual([
      "focus",
      "shortBreak",
      "focus",
      "shortBreak",
    ]);
    expect(result.state.phase).toBe("focus");
    expect(result.state.completedInCycle).toBe(2);
    expect(remainingMs(result.state, AUTO, T0 + 70 * MINUTE)).toBe(15 * MINUTE);
  });

  it("stops after a phase that does not start on its own", () => {
    const settings = { ...S, autoStartBreaks: true };
    const result = settle(start(INITIAL_STATE, settings, T0), settings, T0 + 5 * 60 * MINUTE);
    expect(result.finished.map((phase) => phase.phase)).toEqual(["focus", "shortBreak"]);
    expect(result.state).toEqual({ phase: "focus", completedInCycle: 1, run: { kind: "idle" } });
  });
});

describe("ending early", () => {
  const tenMinutesIn = (state: TimerState) => start(state, S, T0);

  it("skips to the break, keeping the minutes focused but not counting a pomodoro", () => {
    const result = skip(tenMinutesIn(INITIAL_STATE), S, T0 + 10 * MINUTE);
    expect(result.state).toEqual({
      phase: "shortBreak",
      completedInCycle: 1,
      run: { kind: "idle" },
    });
    expect(result.focus).toEqual([
      { startedAt: T0, endedAt: T0 + 10 * MINUTE, durationMs: 10 * MINUTE, completed: false },
    ]);
  });

  it("ignores less than a minute of focus", () => {
    expect(skip(tenMinutesIn(INITIAL_STATE), S, T0 + 30_000).focus).toEqual([]);
    expect(reset(tenMinutesIn(INITIAL_STATE), S, T0 + 30_000).focus).toEqual([]);
  });

  it("resets to the start of the same phase", () => {
    const result = reset(tenMinutesIn(INITIAL_STATE), S, T0 + 2 * MINUTE);
    expect(result.state).toEqual(INITIAL_STATE);
    expect(result.focus[0]?.durationMs).toBe(2 * MINUTE);
  });

  it("does not record a skipped break as focus", () => {
    const onBreak: TimerState = { phase: "shortBreak", completedInCycle: 1, run: { kind: "idle" } };
    const result = skip(start(onBreak, S, T0), S, T0 + 3 * MINUTE);
    expect(result.focus).toEqual([]);
    expect(result.state.phase).toBe("focus");
  });

  it("settles a phase that already ended instead of calling it skipped", () => {
    const result = skip(start(INITIAL_STATE, S, T0), S, T0 + 26 * MINUTE);
    expect(result.focus[0]?.completed).toBe(true);
  });

  it("switches phase by hand and keeps the cycle count", () => {
    const state: TimerState = { phase: "focus", completedInCycle: 2, run: { kind: "idle" } };
    expect(selectPhase(state, "longBreak", S, T0).state).toEqual({
      phase: "longBreak",
      completedInCycle: 2,
      run: { kind: "idle" },
    });
  });
});

describe("formatClock", () => {
  it("rounds up to the second and pads", () => {
    expect(formatClock(25 * MINUTE)).toBe("25:00");
    expect(formatClock(61_001)).toBe("01:02");
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(65 * MINUTE)).toBe("1:05:00");
  });
});

describe("storage", () => {
  it("round-trips a running timer", () => {
    const running = start(INITIAL_STATE, S, T0);
    expect(parseTimerState(JSON.stringify(running))).toEqual(running);
  });

  it("falls back on anything malformed", () => {
    expect(parseTimerState("not json")).toEqual(INITIAL_STATE);
    expect(parseTimerState(JSON.stringify({ phase: "nap", run: { kind: "idle" } }))).toEqual(
      INITIAL_STATE,
    );
    expect(
      parseTimerState(JSON.stringify({ phase: "focus", run: { kind: "running", startedAt: 1 } })),
    ).toEqual(INITIAL_STATE);
  });

  it("clamps settings into range and fills gaps with defaults", () => {
    expect(parseSettings("")).toEqual(DEFAULT_SETTINGS);
    expect(
      parseSettings(
        JSON.stringify({ focusMinutes: 500, shortBreakMinutes: 0, autoStartFocus: true }),
      ),
    ).toEqual({
      ...DEFAULT_SETTINGS,
      focusMinutes: 120,
      shortBreakMinutes: 1,
      autoStartFocus: true,
    });
  });
});
