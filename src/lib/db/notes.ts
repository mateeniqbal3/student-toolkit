/**
 * Typed accessors for notes and their folders.
 */
import {
  noteFingerprint,
  type BackupFolder,
  type BackupNote,
  type ImportedMarkdown,
} from "@/lib/notes/transfer";

import { db, type NoteFolderRecord, type NoteRecord } from "./schema";

export async function addNote(folderId: number | null, tags: string[] = []): Promise<number> {
  const now = Date.now();
  return db.notes.add({
    title: "",
    body: "",
    folderId,
    tags,
    pinned: false,
    trashedAt: null,
    createdAt: now,
    updatedAt: now,
  });
}

/** Edits to what a note says or where it lives, which move it up the list. */
export async function updateNote(
  id: number,
  patch: Partial<Pick<NoteRecord, "title" | "body" | "folderId" | "tags">>,
): Promise<void> {
  await db.notes.update(id, { ...patch, updatedAt: Date.now() });
}

/** Pinning is not an edit, so it leaves the note's place in time alone. */
export async function setPinned(id: number, pinned: boolean): Promise<void> {
  await db.notes.update(id, { pinned });
}

export async function trashNote(id: number): Promise<void> {
  await db.notes.update(id, { trashedAt: Date.now(), pinned: false });
}

export async function restoreNote(id: number): Promise<void> {
  await db.transaction("rw", db.notes, db.noteFolders, async () => {
    const note = await db.notes.get(id);
    if (!note) return;
    // Its folder may have been deleted while it sat in the trash.
    const folder = note.folderId === null ? undefined : await db.noteFolders.get(note.folderId);
    await db.notes.update(id, { trashedAt: null, folderId: folder ? folder.id : null });
  });
}

export async function deleteNoteForever(id: number): Promise<void> {
  await db.notes.delete(id);
}

export async function emptyTrash(): Promise<void> {
  const trashed = await db.notes.filter((note) => note.trashedAt !== null).primaryKeys();
  await db.notes.bulkDelete(trashed);
}

export async function addFolder(name: string, parentId: number | null): Promise<number> {
  return db.noteFolders.add({ name, parentId, createdAt: Date.now() });
}

export async function updateFolder(
  id: number,
  patch: Partial<Pick<NoteFolderRecord, "name" | "parentId">>,
): Promise<void> {
  await db.noteFolders.update(id, patch);
}

/**
 * Deletes a folder but never its contents: its notes and subfolders move up
 * to wherever the folder itself was.
 */
export async function deleteFolder(id: number): Promise<void> {
  await db.transaction("rw", db.noteFolders, db.notes, async () => {
    const folder = await db.noteFolders.get(id);
    if (!folder) return;
    await db.noteFolders.where("parentId").equals(id).modify({ parentId: folder.parentId });
    await db.notes.where("folderId").equals(id).modify({ folderId: folder.parentId });
    await db.noteFolders.delete(id);
  });
}

export interface ImportSummary {
  added: number;
  /** Already here, so not added again. */
  duplicates: number;
}

/** Notes in the trash do not count: importing one is a way to get it back. */
async function existingFingerprints(): Promise<Set<string>> {
  const notes = await db.notes.filter((note) => note.trashedAt === null).toArray();
  return new Set(notes.map(noteFingerprint));
}

/**
 * Adds a backup's folders and notes to what is already here. A folder with
 * the same name in the same place is reused rather than duplicated, and a
 * note already present (same title, text and creation time) is skipped, so
 * importing the same backup twice changes nothing.
 */
export async function importBackup(
  folders: readonly BackupFolder[],
  notes: readonly BackupNote[],
): Promise<ImportSummary> {
  return db.transaction("rw", db.noteFolders, db.notes, async () => {
    const existing = await db.noteFolders.toArray();
    const key = (parentId: number | null, name: string) =>
      `${parentId ?? "root"}\u0000${name.toLocaleLowerCase()}`;
    const byKey = new Map(existing.map((folder) => [key(folder.parentId, folder.name), folder.id]));

    // Parents before children, however the file orders them.
    const idMap = new Map<number, number>();
    const pending = [...folders];
    while (pending.length > 0) {
      const ready = pending.findIndex(
        (folder) =>
          folder.parentId === null ||
          idMap.has(folder.parentId) ||
          !folders.some((candidate) => candidate.id === folder.parentId),
      );
      // Only a cycle leaves nothing ready; break it at the top level.
      const [folder] = pending.splice(ready === -1 ? 0 : ready, 1);
      if (!folder) break;
      const parentId =
        ready === -1 || folder.parentId === null ? null : (idMap.get(folder.parentId) ?? null);
      const found = byKey.get(key(parentId, folder.name));
      const id = found ?? (await addFolder(folder.name, parentId));
      byKey.set(key(parentId, folder.name), id);
      idMap.set(folder.id, id);
    }

    const seen = await existingFingerprints();
    let added = 0;
    let duplicates = 0;
    for (const note of notes) {
      const fingerprint = noteFingerprint(note);
      if (seen.has(fingerprint)) {
        duplicates += 1;
        continue;
      }
      seen.add(fingerprint);
      await db.notes.add({
        title: note.title,
        body: note.body,
        tags: note.tags,
        pinned: note.pinned,
        folderId: note.folderId === null ? null : (idMap.get(note.folderId) ?? null),
        trashedAt: null,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
      });
      added += 1;
    }
    return { added, duplicates };
  });
}

/** Adds Markdown files as notes in one folder, skipping any already here. */
export async function importMarkdown(
  files: readonly ImportedMarkdown[],
  folderId: number | null,
): Promise<ImportSummary> {
  const now = Date.now();
  return db.transaction("rw", db.notes, async () => {
    const seen = await existingFingerprints();
    let added = 0;
    let duplicates = 0;
    for (const [index, file] of files.entries()) {
      const createdAt = file.createdAt ?? now + index;
      const note = { title: file.title, body: file.body, createdAt };
      if (seen.has(noteFingerprint(note))) {
        duplicates += 1;
        continue;
      }
      seen.add(noteFingerprint(note));
      await db.notes.add({
        ...note,
        tags: file.tags,
        folderId,
        pinned: false,
        trashedAt: null,
        updatedAt: file.updatedAt ?? createdAt,
      });
      added += 1;
    }
    return { added, duplicates };
  });
}

export type { NoteFolderRecord, NoteRecord };
