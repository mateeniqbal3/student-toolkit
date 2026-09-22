"use client";

import {
  ArrowLeft,
  Bold,
  Code,
  Download,
  Heading,
  Italic,
  List,
  Pin,
  PinOff,
  Sigma,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { downloadFile, fileSlug } from "@/components/download";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useLocalStorage } from "@/hooks/use-local-storage";
import {
  setPinned,
  trashNote,
  updateNote,
  type NoteFolderRecord,
  type NoteRecord,
} from "@/lib/db/notes";
import { folderPath, type FolderRow } from "@/lib/notes/folders";
import { formatTags, parseTags } from "@/lib/notes/tags";
import { displayTitle, wordCount } from "@/lib/notes/text";
import { noteToMarkdown } from "@/lib/notes/transfer";
import { cn } from "@/lib/utils";

import { NotePreview } from "./note-preview";

const MODE_STORAGE_KEY = "toolkit:notes:mode";
const SAVE_DELAY_MS = 400;

type Mode = "write" | "split" | "preview";
const MODES: { mode: Mode; label: string }[] = [
  { mode: "write", label: "Write" },
  { mode: "split", label: "Both" },
  { mode: "preview", label: "Preview" },
];

type TextPatch = Partial<Pick<NoteRecord, "title" | "body">>;

/**
 * One note, edited in place. Typing is saved a moment after it stops, and
 * straight away when the note is closed or the page is hidden, so switching
 * apps on a phone never loses the last sentence.
 *
 * The text is held locally and not re-read from the database while editing:
 * the live query echoing each save back would otherwise fight the cursor.
 */
export function NoteEditor({
  note,
  folders,
  allFolders,
  onBack,
  onTrashed,
}: {
  note: NoteRecord;
  folders: FolderRow<NoteFolderRecord>[];
  allFolders: NoteFolderRecord[];
  onBack: () => void;
  onTrashed: () => void;
}) {
  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);
  const [tagsText, setTagsText] = useState(formatTags(note.tags));
  const [saving, setSaving] = useState(false);
  const [modeSetting, setMode] = useLocalStorage(MODE_STORAGE_KEY, "write");
  const mode: Mode = modeSetting === "split" || modeSetting === "preview" ? modeSetting : "write";
  const textarea = useRef<HTMLTextAreaElement>(null);

  const pending = useRef<TextPatch>({});
  const timer = useRef<number | undefined>(undefined);

  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    const patch = pending.current;
    pending.current = {};
    if (Object.keys(patch).length === 0) return;
    await updateNote(note.id, patch);
    // More typing may have been queued while this save was in flight.
    setSaving(Object.keys(pending.current).length > 0);
  }, [note.id]);

  function queue(patch: TextPatch) {
    pending.current = { ...pending.current, ...patch };
    setSaving(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flush(), SAVE_DELAY_MS);
  }

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    const onPageHide = () => void flush();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      void flush();
    };
  }, [flush]);

  // A new, empty note starts with the cursor in the title.
  const startsEmpty = useRef(note.title === "" && note.body === "");
  const titleInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (startsEmpty.current) titleInput.current?.focus();
  }, []);

  function commitTags() {
    const tags = parseTags(tagsText);
    setTagsText(formatTags(tags));
    if (tags.join() !== note.tags.join()) void updateNote(note.id, { tags });
  }

  /** Wraps the selection in Markdown syntax, or inserts a placeholder to type over. */
  function wrap(before: string, after: string, placeholder: string) {
    const element = textarea.current;
    if (!element) return;
    const { selectionStart: start, selectionEnd: end } = element;
    const selected = body.slice(start, end) || placeholder;
    const next = `${body.slice(0, start)}${before}${selected}${after}${body.slice(end)}`;
    setBody(next);
    queue({ body: next });
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  }

  /** Puts a prefix at the start of each selected line: headings and lists. */
  function prefixLines(prefix: string) {
    const element = textarea.current;
    if (!element) return;
    const { selectionStart: start, selectionEnd: end } = element;
    const lineStart = body.lastIndexOf("\n", start - 1) + 1;
    const block = body.slice(lineStart, end);
    const prefixed = block
      .split("\n")
      .map((line) => `${prefix}${line}`)
      .join("\n");
    const next = `${body.slice(0, lineStart)}${prefixed}${body.slice(end)}`;
    setBody(next);
    queue({ body: next });
    requestAnimationFrame(() => {
      element.focus();
      const caret = end + (prefixed.length - block.length);
      element.setSelectionRange(caret, caret);
    });
  }

  function download() {
    const name = displayTitle(title, body) || "Untitled";
    const text = noteToMarkdown(
      { title: name, body, tags: note.tags, createdAt: note.createdAt, updatedAt: Date.now() },
      folderPath(allFolders, note.folderId),
    );
    downloadFile(`${fileSlug(name, "note")}.md`, text, "text/markdown;charset=utf-8");
  }

  const words = wordCount(body);

  return (
    <article aria-label="Note" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1">
        <Button variant="ghost" size="sm" className="md:hidden" onClick={onBack}>
          <ArrowLeft className="size-4" aria-hidden />
          Notes
        </Button>
        <div className="ms-auto flex items-center gap-1">
          <span className="text-muted-foreground me-1 text-xs" aria-live="polite">
            {saving ? "Saving…" : "Saved"}
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label={note.pinned ? "Unpin note" : "Pin note"}
            title={note.pinned ? "Unpin" : "Pin to the top"}
            aria-pressed={note.pinned}
            onClick={() => void setPinned(note.id, !note.pinned)}
          >
            {note.pinned ? (
              <PinOff className="size-4" aria-hidden />
            ) : (
              <Pin className="size-4" aria-hidden />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Download as Markdown"
            title="Download as Markdown (.md)"
            onClick={download}
          >
            <Download className="size-4" aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Move to trash"
            title="Move to trash"
            onClick={async () => {
              await flush();
              await trashNote(note.id);
              onTrashed();
            }}
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        </div>
      </div>

      <Input
        ref={titleInput}
        aria-label="Title"
        className="font-display h-11 text-xl font-semibold"
        placeholder="Untitled"
        value={title}
        onChange={(event) => {
          setTitle(event.target.value);
          queue({ title: event.target.value });
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            textarea.current?.focus();
          }
        }}
      />

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="note-folder" className="text-muted-foreground text-xs">
            Folder
          </Label>
          <NativeSelect
            id="note-folder"
            className="h-9"
            value={note.folderId === null ? "" : String(note.folderId)}
            onChange={(event) => {
              const id = Number.parseInt(event.target.value, 10);
              void updateNote(note.id, { folderId: Number.isSafeInteger(id) ? id : null });
            }}
          >
            <option value="">No folder</option>
            {folders.map(({ folder, depth }) => (
              <option key={folder.id} value={folder.id}>
                {"  ".repeat(depth)}
                {folder.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="note-tags" className="text-muted-foreground text-xs">
            Tags
          </Label>
          <Input
            id="note-tags"
            className="h-9"
            placeholder="biology, exam-prep"
            autoComplete="off"
            value={tagsText}
            onChange={(event) => setTagsText(event.target.value)}
            onBlur={commitTags}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitTags();
              }
            }}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div
          role="group"
          aria-label="Editor view"
          className="bg-muted inline-grid grid-cols-3 gap-1 rounded-lg p-1"
        >
          {MODES.map((option) => (
            <button
              key={option.mode}
              type="button"
              aria-pressed={mode === option.mode}
              className="aria-pressed:bg-background aria-pressed:text-foreground text-muted-foreground rounded-md px-3 py-1 text-sm font-medium transition-colors aria-pressed:shadow-sm"
              onClick={() => setMode(option.mode)}
            >
              {option.label}
            </button>
          ))}
        </div>
        {mode !== "preview" ? (
          <div role="toolbar" aria-label="Formatting" className="flex flex-wrap gap-0.5">
            <ToolButton label="Bold (Ctrl+B)" onClick={() => wrap("**", "**", "bold")}>
              <Bold className="size-4" aria-hidden />
            </ToolButton>
            <ToolButton label="Italic (Ctrl+I)" onClick={() => wrap("_", "_", "italic")}>
              <Italic className="size-4" aria-hidden />
            </ToolButton>
            <ToolButton label="Heading" onClick={() => prefixLines("## ")}>
              <Heading className="size-4" aria-hidden />
            </ToolButton>
            <ToolButton label="List" onClick={() => prefixLines("- ")}>
              <List className="size-4" aria-hidden />
            </ToolButton>
            <ToolButton label="Code" onClick={() => wrap("`", "`", "code")}>
              <Code className="size-4" aria-hidden />
            </ToolButton>
            <ToolButton label="Maths" onClick={() => wrap("$", "$", "x^2")}>
              <Sigma className="size-4" aria-hidden />
            </ToolButton>
          </div>
        ) : null}
      </div>

      {/* minmax(0, …) so a wide equation or code block scrolls in its own box
          instead of stretching the column past the screen. */}
      <div
        className={cn(
          "grid grid-cols-[minmax(0,1fr)] gap-4",
          mode === "split" && "xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]",
        )}
      >
        {mode !== "preview" ? (
          <Textarea
            ref={textarea}
            aria-label="Note text"
            className="min-h-[50vh] resize-y font-mono text-sm leading-relaxed"
            placeholder={"Start writing. Markdown works: # heading, **bold**, - list, $E = mc^2$"}
            value={body}
            onChange={(event) => {
              setBody(event.target.value);
              queue({ body: event.target.value });
            }}
            onKeyDown={(event) => {
              if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
              if (event.key === "b") {
                event.preventDefault();
                wrap("**", "**", "bold");
              } else if (event.key === "i") {
                event.preventDefault();
                wrap("_", "_", "italic");
              }
            }}
          />
        ) : null}
        {mode !== "write" ? (
          <div className="bg-card ring-foreground/10 min-h-40 rounded-xl p-4 ring-1 sm:p-6">
            <NotePreview markdown={body} />
          </div>
        ) : null}
      </div>

      <p className="text-muted-foreground text-xs tabular-nums">
        {words === 1 ? "1 word" : `${words} words`}
      </p>
    </article>
  );
}

function ToolButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      // Keeps the selection in the textarea while the button is pressed.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
