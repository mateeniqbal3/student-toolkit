"use client";

import { Pin, Plus, Search, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { emptyTrash, type NoteFolderRecord, type NoteRecord } from "@/lib/db/notes";
import type { FolderRow } from "@/lib/notes/folders";
import type { TagCount } from "@/lib/notes/tags";
import { displayTitle, snippet } from "@/lib/notes/text";
import { cn } from "@/lib/utils";

import { BackupPanel } from "./backup-panel";
import { FolderManager } from "./folder-manager";
import { viewFolderId, type NotesView } from "./view";

/** Tags beyond this many are reachable through search instead. */
const VISIBLE_TAGS = 12;

export function NoteSidebar({
  view,
  onViewChange,
  folders,
  folderList,
  liveCount,
  trashCount,
  tags,
  tag,
  onTagChange,
  query,
  onQueryChange,
  notes,
  allNotes,
  selectedId,
  onSelect,
  onCreate,
}: {
  view: NotesView;
  onViewChange: (view: NotesView) => void;
  folders: FolderRow<NoteFolderRecord>[];
  folderList: NoteFolderRecord[];
  liveCount: number;
  trashCount: number;
  tags: TagCount[];
  tag: string | null;
  onTagChange: (tag: string | null) => void;
  query: string;
  onQueryChange: (query: string) => void;
  notes: NoteRecord[];
  allNotes: NoteRecord[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onCreate: () => void;
}) {
  const inTrash = view === "trash";
  const importFolderId = viewFolderId(view);

  return (
    <div className="flex flex-col gap-3">
      <Button className="h-10 w-full" onClick={onCreate}>
        <Plus className="size-4" aria-hidden />
        New note
      </Button>

      <div className="relative">
        <Search
          className="text-muted-foreground pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2"
          aria-hidden
        />
        <Input
          aria-label="Search notes"
          type="search"
          className="h-9 ps-8"
          placeholder="Search notes"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notes-view" className="text-muted-foreground text-xs">
          Show
        </Label>
        <NativeSelect
          id="notes-view"
          className="h-9"
          value={view}
          onChange={(event) => onViewChange(event.target.value as NotesView)}
        >
          <option value="all">All notes ({liveCount})</option>
          <option value="unfiled">Not in a folder</option>
          {folders.length > 0 ? (
            <optgroup label="Folders">
              {folders.map(({ folder, depth }) => (
                <option key={folder.id} value={`folder:${folder.id}`}>
                  {"  ".repeat(depth)}
                  {folder.name}
                </option>
              ))}
            </optgroup>
          ) : null}
          <option value="trash">Trash ({trashCount})</option>
        </NativeSelect>
      </div>

      {tags.length > 0 && !inTrash ? (
        <div role="group" aria-label="Filter by tag" className="flex flex-wrap gap-1.5">
          {tags.slice(0, VISIBLE_TAGS).map(({ tag: name, count }) => (
            <button
              key={name}
              type="button"
              aria-pressed={tag === name}
              className="bg-muted text-muted-foreground aria-pressed:bg-primary aria-pressed:text-primary-foreground rounded-full px-2.5 py-1 text-xs transition-colors"
              onClick={() => onTagChange(tag === name ? null : name)}
            >
              #{name} <span className="tabular-nums opacity-70">{count}</span>
            </button>
          ))}
        </div>
      ) : null}

      {inTrash && trashCount > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-muted-foreground min-w-0 flex-1 text-xs">
            Notes in the trash stay until you delete them.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (window.confirm("Delete every note in the trash? This cannot be undone.")) {
                void emptyTrash();
              }
            }}
          >
            <Trash2 className="size-3.5" aria-hidden />
            Empty trash
          </Button>
        </div>
      ) : null}

      <NoteList
        notes={notes}
        selectedId={selectedId}
        onSelect={onSelect}
        emptyMessage={
          query.trim()
            ? `No notes match “${query.trim()}”.`
            : inTrash
              ? "The trash is empty."
              : tag
                ? `No notes here are tagged #${tag}.`
                : liveCount === 0
                  ? "No notes yet."
                  : "No notes here yet."
        }
      />

      <div className="mt-2 flex flex-col gap-2">
        <details className="rounded-lg border">
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium select-none">
            Folders
          </summary>
          <FolderManager rows={folders} folders={folderList} />
        </details>
        <details className="rounded-lg border">
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium select-none">
            Backup and import
          </summary>
          <BackupPanel notes={allNotes} folders={folderList} importFolderId={importFolderId} />
        </details>
      </div>
    </div>
  );
}

function NoteList({
  notes,
  selectedId,
  onSelect,
  emptyMessage,
}: {
  notes: NoteRecord[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  emptyMessage: string;
}) {
  if (notes.length === 0) {
    return <p className="text-muted-foreground py-2 text-sm">{emptyMessage}</p>;
  }

  return (
    <ul aria-label="Notes" className="flex flex-col gap-1">
      {notes.map((note) => {
        const title = displayTitle(note.title, note.body) || "Untitled";
        const preview = snippet(note.body, 90, title);
        return (
          <li key={note.id}>
            <button
              type="button"
              aria-current={note.id === selectedId ? "true" : undefined}
              className={cn(
                "hover:bg-accent flex w-full flex-col gap-0.5 rounded-lg px-3 py-2 text-start transition-colors",
                note.id === selectedId && "bg-accent",
              )}
              onClick={() => onSelect(note.id)}
            >
              <span className="flex items-center gap-1.5">
                {note.pinned ? (
                  <Pin className="text-primary size-3.5 shrink-0" aria-label="Pinned" />
                ) : null}
                <span className="truncate text-sm font-medium">{title}</span>
                <time
                  className="text-muted-foreground ms-auto shrink-0 text-xs tabular-nums"
                  dateTime={new Date(note.updatedAt).toISOString()}
                >
                  {formatUpdated(note.updatedAt)}
                </time>
              </span>
              {preview ? (
                <span className="text-muted-foreground line-clamp-2 text-xs break-words">
                  {preview}
                </span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** The time for today's notes, a date otherwise; the year only when it is not this one. */
function formatUpdated(time: number): string {
  const date = new Date(time);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}
