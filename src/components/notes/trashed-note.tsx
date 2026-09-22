"use client";

import { ArrowLeft, RotateCcw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { deleteNoteForever, restoreNote, type NoteRecord } from "@/lib/db/notes";
import { displayTitle } from "@/lib/notes/text";

import { NotePreview } from "./note-preview";

/** A note in the trash: readable, not editable, and one tap from coming back. */
export function TrashedNote({ note, onBack }: { note: NoteRecord; onBack: () => void }) {
  const title = displayTitle(note.title, note.body) || "Untitled";

  return (
    <article aria-label="Note in the trash" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" className="md:hidden" onClick={onBack}>
          <ArrowLeft className="size-4" aria-hidden />
          Trash
        </Button>
        <div className="ms-auto flex gap-2">
          <Button variant="outline" onClick={() => void restoreNote(note.id)}>
            <RotateCcw className="size-4" aria-hidden />
            Restore
          </Button>
          <Button
            variant="destructive"
            onClick={async () => {
              if (!window.confirm(`Delete “${title}” for good? This cannot be undone.`)) return;
              await deleteNoteForever(note.id);
              onBack();
            }}
          >
            <Trash2 className="size-4" aria-hidden />
            Delete forever
          </Button>
        </div>
      </div>
      <p className="bg-muted text-muted-foreground rounded-lg px-3 py-2 text-sm">
        This note is in the trash. Restore it to edit it.
      </p>
      <h2 className="font-display text-2xl font-semibold break-words">{title}</h2>
      <div className="bg-card ring-foreground/10 rounded-xl p-4 ring-1 sm:p-6">
        <NotePreview markdown={note.body} />
      </div>
    </article>
  );
}
