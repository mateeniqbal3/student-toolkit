"use client";

import { Download, FileUp } from "lucide-react";
import { useId, useState, type ChangeEvent } from "react";

import { downloadFile } from "@/components/download";
import { Button } from "@/components/ui/button";
import {
  importBackup,
  importMarkdown,
  type ImportSummary,
  type NoteFolderRecord,
  type NoteRecord,
} from "@/lib/db/notes";
import { createBackup, markdownToNote, parseBackup } from "@/lib/notes/transfer";

const BACKUP_ERRORS = {
  "not-json": "That file is not a notes backup: it could not be read as JSON.",
  "not-a-backup": "That file is not a notes backup from this app.",
  "newer-version":
    "That backup is from a newer version of this app. Reload the page and try again.",
} as const;

function summarise({ added, duplicates }: ImportSummary, skipped = 0): string {
  const parts = [`Added ${added} ${added === 1 ? "note" : "notes"}.`];
  if (duplicates > 0) {
    parts.push(`${duplicates} ${duplicates === 1 ? "was" : "were"} already here.`);
  }
  if (skipped > 0) {
    parts.push(`${skipped} could not be read and ${skipped === 1 ? "was" : "were"} skipped.`);
  }
  return parts.join(" ");
}

/**
 * Everything out as one file, and back in again: a backup made here, or
 * Markdown files from here or from Obsidian, Notion and the like. Files are
 * read in the browser; nothing is uploaded.
 */
export function BackupPanel({
  notes,
  folders,
  importFolderId,
}: {
  /** Notes not in the trash. */
  notes: NoteRecord[];
  folders: NoteFolderRecord[];
  /** Where imported Markdown files go: the folder being viewed, if any. */
  importFolderId: number | null;
}) {
  const [status, setStatus] = useState("");
  const id = useId();

  function backup() {
    const now = Date.now();
    const text = createBackup(folders, notes, now);
    const date = new Date(now).toISOString().slice(0, 10);
    downloadFile(`notes-backup-${date}.json`, text, "application/json;charset=utf-8");
  }

  async function readFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])];
    event.target.value = "";
    if (files.length === 0) return;

    const backups = files.filter((file) => /\.json$/i.test(file.name));
    const markdown = files.filter((file) => !/\.json$/i.test(file.name));
    const messages: string[] = [];

    for (const file of backups) {
      const result = parseBackup(await file.text(), Date.now());
      if (!result.ok) {
        messages.push(BACKUP_ERRORS[result.reason]);
        continue;
      }
      messages.push(summarise(await importBackup(result.folders, result.notes), result.skipped));
    }

    if (markdown.length > 0) {
      const parsed = await Promise.all(
        markdown.map(async (file) => markdownToNote(file.name, await file.text())),
      );
      messages.push(summarise(await importMarkdown(parsed, importFolderId)));
    }

    setStatus(messages.join(" "));
  }

  return (
    <div className="flex flex-col gap-3 border-t p-3">
      <p className="text-muted-foreground text-xs text-pretty">
        Notes live only in this browser. Download a backup now and then; clearing site data or
        losing the phone would otherwise lose them.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={notes.length === 0} onClick={backup}>
          <Download className="size-3.5" aria-hidden />
          Download backup
        </Button>
        <Button variant="outline" size="sm" asChild>
          <label htmlFor={`${id}-file`} className="cursor-pointer">
            <FileUp className="size-3.5" aria-hidden />
            Import
          </label>
        </Button>
        <input
          id={`${id}-file`}
          type="file"
          multiple
          accept=".json,.md,.markdown,.txt,application/json,text/markdown,text/plain"
          className="sr-only"
          aria-label="Import a backup or Markdown files"
          onChange={(event) => void readFiles(event)}
        />
      </div>
      <p className="text-muted-foreground text-xs text-pretty">
        Import takes a backup from here, or Markdown files, which go into the folder you are
        viewing. Nothing is overwritten, and notes already here are not added twice.
      </p>
      <p role="status" className="text-xs">
        {status}
      </p>
    </div>
  );
}
