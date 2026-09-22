/**
 * Getting notes out and back in.
 *
 * A single note exports as a Markdown file with a small front-matter header,
 * which Obsidian, Notion, Typora and GitHub all read, so a note is never
 * locked in here. A full backup is one JSON file holding every folder and
 * note, and importing it adds to what is there rather than replacing it.
 */
import { normaliseTag } from "./tags";

export interface NoteContent {
  title: string;
  body: string;
  tags: string[];
}

export interface ExportableNote extends NoteContent {
  createdAt: number;
  updatedAt: number;
}

// --- Markdown files ----------------------------------------------------------

/** JSON string syntax is valid YAML, and it quotes anything awkward. */
function yamlString(value: string): string {
  return JSON.stringify(value);
}

export function noteToMarkdown(note: ExportableNote, folder: readonly string[]): string {
  const lines = ["---", `title: ${yamlString(note.title)}`];
  if (note.tags.length > 0) lines.push(`tags: [${note.tags.map(yamlString).join(", ")}]`);
  if (folder.length > 0) lines.push(`folder: ${yamlString(folder.join("/"))}`);
  lines.push(`created: ${new Date(note.createdAt).toISOString()}`);
  lines.push(`updated: ${new Date(note.updatedAt).toISOString()}`);
  lines.push("---", "", "");
  return `${lines.join("\n")}${note.body.endsWith("\n") ? note.body : `${note.body}\n`}`;
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('"')) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (typeof parsed === "string") return parsed;
    } catch {
      // Not JSON-quoted after all; fall through.
    }
  }
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith("'") && trimmed.endsWith("'")) ||
      (trimmed.startsWith('"') && trimmed.endsWith('"')))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function yamlList(value: string): string[] {
  const trimmed = value.trim();
  const inner = trimmed.startsWith("[") && trimmed.endsWith("]") ? trimmed.slice(1, -1) : trimmed;
  return inner
    .split(",")
    .map(unquote)
    .filter((item) => item.length > 0);
}

function parseDate(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const time = Date.parse(unquote(value));
  return Number.isFinite(time) ? time : undefined;
}

export interface ImportedMarkdown extends NoteContent {
  createdAt?: number;
  updatedAt?: number;
}

/**
 * Reads a Markdown file. Front matter is honoured when present, including
 * the block-list form of tags other apps write; otherwise the title is the
 * first heading, or failing that the file name.
 */
export function markdownToNote(filename: string, text: string): ImportedMarkdown {
  const normalised = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const fields = new Map<string, string>();
  let tags: string[] = [];
  let body = normalised;

  const match = /^---\n([\s\S]*?)\n---[ \t]*(?:\n|$)/.exec(normalised);
  if (match) {
    body = normalised.slice(match[0].length);
    let listKey: string | null = null;
    const blockList: string[] = [];
    for (const line of (match[1] ?? "").split("\n")) {
      const item = /^\s*-\s+(.*)$/.exec(line);
      if (item && listKey === "tags") {
        blockList.push(unquote(item[1] ?? ""));
        continue;
      }
      const pair = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
      if (!pair) continue;
      listKey = (pair[1] ?? "").toLowerCase();
      fields.set(listKey, pair[2] ?? "");
    }
    const tagField = fields.get("tags");
    const rawTags = tagField ? yamlList(tagField) : blockList;
    tags = [...new Set(rawTags.map(normaliseTag).filter((tag): tag is string => tag !== null))];
  }

  body = body.replace(/^\n+/, "");
  let title = fields.has("title") ? unquote(fields.get("title") ?? "") : "";
  if (!title) {
    const heading = /^#\s+(.+?)\s*#*\s*$/m.exec(body);
    title = heading?.[1] ?? filename.replace(/\.(md|markdown|txt)$/i, "");
  }

  return {
    title: title.trim(),
    body,
    tags,
    createdAt: parseDate(fields.get("created") ?? fields.get("date")),
    updatedAt: parseDate(fields.get("updated") ?? fields.get("modified")),
  };
}

// --- Full backup -------------------------------------------------------------

export const BACKUP_FORMAT = "student-toolkit-notes";
export const BACKUP_VERSION = 1;

export interface BackupFolder {
  id: number;
  name: string;
  parentId: number | null;
}

export interface BackupNote extends ExportableNote {
  folderId: number | null;
  pinned: boolean;
}

export interface NotesBackup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  folders: BackupFolder[];
  notes: BackupNote[];
}

/** Trashed notes are left out: a backup is what the student means to keep. */
export function createBackup(
  folders: readonly BackupFolder[],
  notes: readonly BackupNote[],
  now: number,
): string {
  const backup: NotesBackup = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date(now).toISOString(),
    folders: folders.map(({ id, name, parentId }) => ({ id, name, parentId })),
    notes: notes.map(({ title, body, tags, folderId, pinned, createdAt, updatedAt }) => ({
      title,
      body,
      tags: [...tags],
      folderId,
      pinned,
      createdAt,
      updatedAt,
    })),
  };
  return `${JSON.stringify(backup, null, 2)}\n`;
}

export type BackupResult =
  | { ok: true; folders: BackupFolder[]; notes: BackupNote[]; skipped: number }
  | { ok: false; reason: "not-json" | "not-a-backup" | "newer-version" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalId(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) ? value : null;
}

function time(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** Validates a backup file field by field; notes that cannot be read are counted and skipped. */
export function parseBackup(text: string, now: number): BackupResult {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, reason: "not-json" };
  }
  if (!isRecord(value) || value.format !== BACKUP_FORMAT) {
    return { ok: false, reason: "not-a-backup" };
  }
  if (typeof value.version !== "number" || value.version > BACKUP_VERSION) {
    return { ok: false, reason: "newer-version" };
  }

  const folders: BackupFolder[] = [];
  for (const item of Array.isArray(value.folders) ? value.folders : []) {
    if (!isRecord(item) || typeof item.name !== "string" || !item.name.trim()) continue;
    const id = optionalId(item.id);
    if (id === null) continue;
    folders.push({ id, name: item.name.trim(), parentId: optionalId(item.parentId) });
  }

  const notes: BackupNote[] = [];
  let skipped = 0;
  for (const item of Array.isArray(value.notes) ? value.notes : []) {
    if (!isRecord(item) || typeof item.body !== "string") {
      skipped += 1;
      continue;
    }
    const tags = Array.isArray(item.tags)
      ? item.tags
          .map((tag) => (typeof tag === "string" ? normaliseTag(tag) : null))
          .filter((tag): tag is string => tag !== null)
      : [];
    const createdAt = time(item.createdAt, now);
    notes.push({
      title: typeof item.title === "string" ? item.title : "",
      body: item.body,
      tags: [...new Set(tags)],
      folderId: optionalId(item.folderId),
      pinned: item.pinned === true,
      createdAt,
      updatedAt: time(item.updatedAt, createdAt),
    });
  }

  return { ok: true, folders, notes, skipped };
}

/**
 * The identity used to skip notes that are already here, so importing the
 * same backup or file twice does not double everything. Same title and same
 * text is the same note, whenever it was made: a Markdown file carries no
 * reliable creation time to compare.
 */
export function noteFingerprint(note: { title: string; body: string }): string {
  return `${note.title.trim()}\u0000${note.body.trim()}`;
}
