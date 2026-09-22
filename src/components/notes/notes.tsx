"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { NotebookPen } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { addNote, type NoteRecord } from "@/lib/db/notes";
import { db } from "@/lib/db/schema";
import { descendantIds, folderRows } from "@/lib/notes/folders";
import { countTags } from "@/lib/notes/tags";
import { cn } from "@/lib/utils";

import { NoteEditor } from "./note-editor";
import { NoteSidebar } from "./note-sidebar";
import { TrashedNote } from "./trashed-note";
import { useNoteSearch } from "./use-note-search";
import { parseView, viewFolderId, type NotesView } from "./view";

const VIEW_STORAGE_KEY = "toolkit:notes:view";

/** Pinned first, then most recently edited. */
function byPinnedThenRecent(a: NoteRecord, b: NoteRecord): number {
  return Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt;
}

export function Notes() {
  const [storedView, setStoredView] = useLocalStorage(VIEW_STORAGE_KEY, "all");
  const [tag, setTag] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const notes = useLiveQuery(() => db.notes.toArray(), []);
  const folders = useLiveQuery(() => db.noteFolders.toArray(), []);

  const rows = useMemo(() => folderRows(folders ?? []), [folders]);
  // A remembered folder that has since been deleted falls back to all notes.
  const parsedView = parseView(storedView);
  const folderId = viewFolderId(parsedView);
  const view: NotesView =
    folderId !== null && folders && !folders.some((folder) => folder.id === folderId)
      ? "all"
      : parsedView;

  const live = useMemo(() => (notes ?? []).filter((note) => note.trashedAt === null), [notes]);
  const trashed = useMemo(() => (notes ?? []).filter((note) => note.trashedAt !== null), [notes]);
  const allNotes = useMemo(() => notes ?? [], [notes]);
  const matches = useNoteSearch(allNotes, query);
  const tags = useMemo(() => countTags(live), [live]);

  const visible = useMemo(() => {
    let pool: NoteRecord[];
    if (view === "trash") pool = trashed;
    else if (view === "unfiled") pool = live.filter((note) => note.folderId === null);
    else if (view === "all") pool = live;
    else {
      const inside = descendantIds(folders ?? [], viewFolderId(view) ?? -1);
      pool = live.filter((note) => note.folderId !== null && inside.has(note.folderId));
    }
    if (tag) pool = pool.filter((note) => note.tags.includes(tag));

    if (!matches) return [...pool].sort(byPinnedThenRecent);
    const inPool = new Map(pool.map((note) => [note.id, note]));
    return matches.flatMap((id) => inPool.get(id) ?? []);
  }, [view, trashed, live, folders, tag, matches]);

  // Warm the Markdown renderer and search once the page is idle, so their
  // code is cached for offline use before the first preview or search.
  useEffect(() => {
    const warm = () => {
      void import("./markdown-renderer");
      void import("@/lib/notes/search");
    };
    // Safari has no requestIdleCallback; a short delay does the same job there.
    if (typeof window.requestIdleCallback === "function") {
      const handle = window.requestIdleCallback(warm, { timeout: 5000 });
      return () => window.cancelIdleCallback(handle);
    }
    const handle = window.setTimeout(warm, 2000);
    return () => window.clearTimeout(handle);
  }, []);

  if (!notes || !folders) return <LoadingState />;

  const selected = notes.find((note) => note.id === selectedId);

  function select(id: number | null) {
    setSelectedId(id);
    // On a phone the list and the note replace each other; start at the top.
    if (window.matchMedia("(max-width: 47.99rem)").matches) window.scrollTo({ top: 0 });
  }

  async function create() {
    const id = await addNote(viewFolderId(view), tag ? [tag] : []);
    if (view === "trash") setStoredView("all");
    select(id);
  }

  return (
    <div className="grid items-start gap-6 md:grid-cols-[18rem_minmax(0,1fr)] lg:grid-cols-[20rem_minmax(0,1fr)]">
      <div className={cn("min-w-0", selected && "hidden md:block")}>
        <NoteSidebar
          view={view}
          onViewChange={(next) => {
            setStoredView(next);
            setTag(null);
          }}
          folders={rows}
          liveCount={live.length}
          trashCount={trashed.length}
          tags={tags}
          tag={tag}
          onTagChange={setTag}
          query={query}
          onQueryChange={setQuery}
          notes={visible}
          folderList={folders}
          selectedId={selected?.id ?? null}
          onSelect={select}
          onCreate={() => void create()}
          allNotes={live}
        />
      </div>

      <div className={cn("min-w-0", !selected && "hidden md:block")}>
        {selected ? (
          selected.trashedAt === null ? (
            <NoteEditor
              key={selected.id}
              note={selected}
              folders={rows}
              allFolders={folders}
              onBack={() => select(null)}
              onTrashed={() => select(null)}
            />
          ) : (
            <TrashedNote key={selected.id} note={selected} onBack={() => select(null)} />
          )
        ) : (
          <EmptyEditor hasNotes={live.length > 0} />
        )}
      </div>
    </div>
  );
}

function EmptyEditor({ hasNotes }: { hasNotes: boolean }) {
  return (
    <div className="text-muted-foreground flex min-h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed p-8 text-center">
      <NotebookPen className="size-8" aria-hidden />
      <p className="max-w-sm text-sm text-pretty">
        {hasNotes
          ? "Pick a note from the list, or start a new one."
          : "Write in Markdown: # for headings, **bold**, - for lists, and $x^2$ for maths. Everything saves as you type, on this device only."}
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading your notes</span>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-20 w-full rounded-xl" />
      <Skeleton className="h-20 w-full rounded-xl" />
    </div>
  );
}
