import { AlertTriangle, Loader2 } from "lucide-react";

import type { TaskState } from "./use-task";

/** Progress while working and the reason when something fails, announced to screen readers. */
export function TaskStatus({ state }: { state: TaskState }) {
  if (state.kind === "working") {
    return (
      <p role="status" className="text-muted-foreground flex items-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        {state.message}
      </p>
    );
  }
  if (state.kind === "error") {
    return (
      <p
        role="alert"
        className="border-destructive/40 text-destructive flex items-start gap-2 rounded-lg border px-3 py-2 text-sm"
      >
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span className="text-pretty">{state.message}</span>
      </p>
    );
  }
  return <p role="status" className="sr-only" />;
}
