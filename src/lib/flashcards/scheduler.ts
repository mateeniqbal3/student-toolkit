/**
 * Spaced-repetition scheduling.
 *
 * This is SM-2 as Anki ran it for fifteen years before FSRS: new cards go
 * through short learning steps, graduate to a one-day interval, and from
 * then on each successful review multiplies the interval by the card's ease.
 * Forgetting a card sends it back through a relearning step and makes it
 * permanently a little harder. It is well understood, predictable enough to
 * show the student what each button will do, and small enough to own and
 * test outright rather than take as a dependency.
 *
 * Every function here is pure: it takes the card's state and the current
 * time and returns the next state. Nothing reads the clock itself.
 */

export type CardState = "new" | "learning" | "review" | "relearning";
export type Grade = "again" | "hard" | "good" | "easy";

export const GRADES: readonly Grade[] = ["again", "hard", "good", "easy"];

export interface SrsState {
  state: CardState;
  /** When the card is next due, in epoch milliseconds. New cards are due immediately. */
  due: number;
  /** The review interval in days. Zero until the card graduates. */
  interval: number;
  /** The interval multiplier, 2.5 to start, never below 1.3. */
  ease: number;
  /** Which learning or relearning step the card is on. */
  step: number;
  reps: number;
  /** Times the card has been forgotten after graduating. */
  lapses: number;
  /** When the card was first studied; counts it against the day's new-card limit. */
  introducedAt?: number;
}

export interface SchedulerSettings {
  /** Minutes. Anki's defaults. */
  learningSteps: readonly number[];
  relearningSteps: readonly number[];
  graduatingInterval: number;
  easyInterval: number;
  startingEase: number;
  minimumEase: number;
  easyBonus: number;
  hardMultiplier: number;
  maximumInterval: number;
}

export const DEFAULT_SCHEDULER: SchedulerSettings = {
  learningSteps: [1, 10],
  relearningSteps: [10],
  graduatingInterval: 1,
  easyInterval: 4,
  startingEase: 2.5,
  minimumEase: 1.3,
  easyBonus: 1.3,
  hardMultiplier: 1.2,
  maximumInterval: 365 * 10,
};

export const MINUTE = 60_000;
export const DAY = 24 * 60 * MINUTE;

export function newSrsState(now: number): SrsState {
  return {
    state: "new",
    due: now,
    interval: 0,
    ease: DEFAULT_SCHEDULER.startingEase,
    step: 0,
    reps: 0,
    lapses: 0,
  };
}

function clampInterval(days: number, settings: SchedulerSettings): number {
  return Math.min(Math.max(Math.round(days), 1), settings.maximumInterval);
}

function inSteps(card: SrsState, steps: readonly number[], grade: Grade, now: number) {
  const at = (index: number) => steps[Math.min(index, steps.length - 1)] ?? 1;

  if (grade === "hard") {
    // Anki's rule: stay on this step, but wait halfway to the next one, or
    // half as long again on the last step. It keeps Hard visibly between
    // Again and Good instead of equal to one of them.
    const current = at(card.step);
    const delay = card.step + 1 < steps.length ? (current + at(card.step + 1)) / 2 : current * 1.5;
    return { step: card.step, due: now + delay * MINUTE };
  }

  const step = grade === "again" ? 0 : card.step + 1;
  return { step, due: now + at(step) * MINUTE };
}

/** The card's state after answering it with `grade` at time `now`. */
export function schedule(
  card: SrsState,
  grade: Grade,
  now: number,
  settings: SchedulerSettings = DEFAULT_SCHEDULER,
): SrsState {
  const base = {
    ...card,
    reps: card.reps + 1,
    introducedAt: card.introducedAt ?? now,
  };

  if (card.state === "new" || card.state === "learning") {
    if (grade === "easy") {
      const interval = clampInterval(settings.easyInterval, settings);
      return { ...base, state: "review", step: 0, interval, due: now + interval * DAY };
    }
    const next = inSteps(card, settings.learningSteps, grade, now);
    if (grade === "good" && next.step >= settings.learningSteps.length) {
      const interval = clampInterval(settings.graduatingInterval, settings);
      return { ...base, state: "review", step: 0, interval, due: now + interval * DAY };
    }
    return { ...base, state: "learning", ...next };
  }

  if (card.state === "relearning") {
    if (grade === "easy" || grade === "good") {
      const done = grade === "easy" || card.step + 1 >= settings.relearningSteps.length;
      if (done) {
        const interval = clampInterval(card.interval, settings);
        return { ...base, state: "review", step: 0, interval, due: now + interval * DAY };
      }
    }
    return { ...base, state: "relearning", ...inSteps(card, settings.relearningSteps, grade, now) };
  }

  // A review card.
  if (grade === "again") {
    // Forgotten: harder from now on, and the interval restarts small once relearnt.
    return {
      ...base,
      state: "relearning",
      step: 0,
      lapses: card.lapses + 1,
      ease: Math.max(settings.minimumEase, card.ease - 0.2),
      interval: 1,
      due: now + (settings.relearningSteps[0] ?? 10) * MINUTE,
    };
  }

  const multiplier =
    grade === "hard"
      ? settings.hardMultiplier
      : grade === "good"
        ? card.ease
        : card.ease * settings.easyBonus;
  const ease =
    grade === "hard"
      ? Math.max(settings.minimumEase, card.ease - 0.15)
      : grade === "easy"
        ? card.ease + 0.15
        : card.ease;
  // Each better answer must never give a shorter interval than a worse one.
  const floor = grade === "hard" ? card.interval + 1 : card.interval + (grade === "good" ? 1 : 2);
  const interval = clampInterval(Math.max(card.interval * multiplier, floor), settings);

  return { ...base, state: "review", step: 0, ease, interval, due: now + interval * DAY };
}

/** What each button would do right now, for the labels under them. */
export function previewIntervals(
  card: SrsState,
  now: number,
  settings: SchedulerSettings = DEFAULT_SCHEDULER,
): Record<Grade, number> {
  return Object.fromEntries(
    GRADES.map((grade) => [grade, schedule(card, grade, now, settings).due - now]),
  ) as Record<Grade, number>;
}

/** "1m", "10m", "1d", "3.5mo", "1.2y": the compact form Anki made familiar. */
export function formatInterval(ms: number): string {
  const minutes = ms / MINUTE;
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))}m`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = ms / DAY;
  if (days < 30) return `${Math.round(days)}d`;
  const months = days / 30;
  if (months < 12) return `${Number(months.toFixed(1))}mo`;
  return `${Number((days / 365).toFixed(1))}y`;
}
