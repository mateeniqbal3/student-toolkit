"use client";

import { useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CardText } from "@/lib/flashcards/transfer";

/**
 * Front and back. When adding, the form clears and returns to the front after
 * each card, because cards are written in runs; Ctrl+Enter saves without
 * reaching for the mouse.
 */
export function CardForm({
  initial = { front: "", back: "" },
  submitLabel,
  onSubmit,
  onCancel,
  clearOnSubmit = false,
}: {
  initial?: CardText;
  submitLabel: string;
  onSubmit: (card: CardText) => Promise<void> | void;
  onCancel?: () => void;
  clearOnSubmit?: boolean;
}) {
  const [front, setFront] = useState(initial.front);
  const [back, setBack] = useState(initial.back);
  const frontRef = useRef<HTMLTextAreaElement>(null);
  const id = useId();
  const ready = front.trim() !== "" && back.trim() !== "";

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!ready) return;
    const submitted = { front, back };
    await onSubmit({ front: front.trim(), back: back.trim() });
    if (clearOnSubmit) {
      // Only clear what was saved: a quick typist may already be writing the
      // next card by the time the save lands.
      setFront((current) => (current === submitted.front ? "" : current));
      setBack((current) => (current === submitted.back ? "" : current));
      frontRef.current?.focus();
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void submit();
    }
    if (event.key === "Escape" && onCancel) onCancel();
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={(event) => void submit(event)}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor={`${id}-front`} className="text-muted-foreground text-xs">
            Front
          </Label>
          <Textarea
            id={`${id}-front`}
            ref={frontRef}
            placeholder="The question, term or prompt"
            value={front}
            onChange={(event) => setFront(event.target.value)}
            onKeyDown={onKeyDown}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor={`${id}-back`} className="text-muted-foreground text-xs">
            Back
          </Label>
          <Textarea
            id={`${id}-back`}
            placeholder="The answer"
            value={back}
            onChange={(event) => setBack(event.target.value)}
            onKeyDown={onKeyDown}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={!ready}>
          {submitLabel}
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <span className="text-muted-foreground ms-auto hidden text-xs sm:inline">
          Ctrl + Enter to save
        </span>
      </div>
    </form>
  );
}
