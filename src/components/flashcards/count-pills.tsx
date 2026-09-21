import type { DayCounts } from "@/lib/flashcards/queue";

type Kind = keyof DayCounts;

const LABELS: Record<Kind, string> = { newCards: "New", learning: "Learning", review: "Due" };

/**
 * What is left for today, the three numbers Anki users read at a glance. The
 * one the current card belongs to can be emphasised during study.
 */
export function CountPills({ counts, current }: { counts: DayCounts; current?: Kind }) {
  return (
    <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs tabular-nums">
      {(Object.keys(LABELS) as Kind[]).map((kind) => (
        <span
          key={kind}
          className={
            kind === current
              ? "text-foreground font-semibold underline underline-offset-4"
              : "text-muted-foreground"
          }
        >
          {LABELS[kind]} <span className="text-foreground font-medium">{counts[kind]}</span>
        </span>
      ))}
    </p>
  );
}
