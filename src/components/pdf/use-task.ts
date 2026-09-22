"use client";

import { useCallback, useRef, useState } from "react";

import { PdfError, type PdfErrorReason } from "@/lib/pdf/errors";

const MESSAGES: Record<PdfErrorReason | "failed" | "worker-crashed", string> = {
  encrypted:
    "This PDF is password-protected or locked against editing, so it cannot be changed here. If you can open it, printing it to a new PDF removes the lock.",
  invalid: "This file could not be read as a PDF. It may be damaged, or not a PDF at all.",
  "unsupported-text":
    "That text uses characters the built-in PDF fonts cannot draw. Use Latin letters, numbers and common punctuation.",
  "no-pages": "There are no pages to save.",
  "worker-crashed":
    "The browser ran out of memory. Try fewer or smaller files, or close other tabs and try again.",
  failed: "Something went wrong while processing the file. Please try again.",
};

export function messageFor(error: unknown): string {
  if (error instanceof PdfError) return MESSAGES[error.reason];
  if (error instanceof Error && error.message === "worker-crashed")
    return MESSAGES["worker-crashed"];
  return MESSAGES.failed;
}

export type TaskState =
  { kind: "idle" } | { kind: "working"; message: string } | { kind: "error"; message: string };

/**
 * One piece of work at a time, with progress to show and a plain-language
 * error if it fails. Starting again while working is ignored, so a double
 * tap cannot run a merge twice.
 */
export function useTask() {
  const [state, setState] = useState<TaskState>({ kind: "idle" });
  const busy = useRef(false);

  const run = useCallback(
    async <T>(
      message: string,
      work: (progress: (message: string) => void) => Promise<T>,
    ): Promise<T | undefined> => {
      if (busy.current) return undefined;
      busy.current = true;
      setState({ kind: "working", message });
      try {
        const result = await work((next) => setState({ kind: "working", message: next }));
        setState({ kind: "idle" });
        return result;
      } catch (error) {
        setState({ kind: "error", message: messageFor(error) });
        return undefined;
      } finally {
        busy.current = false;
      }
    },
    [],
  );

  const fail = useCallback((error: unknown) => {
    setState({ kind: "error", message: messageFor(error) });
  }, []);

  const clear = useCallback(() => setState({ kind: "idle" }), []);

  return { state, working: state.kind === "working", run, fail, clear };
}
