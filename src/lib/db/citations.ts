/**
 * Typed accessors for the citation tables.
 *
 * As with the GPA tables, components call these rather than Dexie, which
 * keeps the invariants in one place: there is always at least one project,
 * a project's sources go with it when it is deleted, and every stored item's
 * `id` is its record's key, so a citation processor can tell sources apart.
 */
import type { CitationStyleId, CslItem } from "@/lib/citation/types";

import { db, type CitationProjectRecord, type CitationRecord } from "./schema";

/**
 * A first visit gets a project to add sources to. The name comes from the
 * caller because it is user-facing copy, and copy does not live in the
 * storage layer.
 */
export async function ensureFirstProject(name: string, style: CitationStyleId): Promise<void> {
  await db.transaction("rw", db.citationProjects, async () => {
    if ((await db.citationProjects.count()) > 0) return;
    await db.citationProjects.add({ name, style, createdAt: Date.now() });
  });
}

export async function addProject(name: string, style: CitationStyleId): Promise<number> {
  return db.citationProjects.add({ name, style, createdAt: Date.now() });
}

export async function renameProject(id: number, name: string): Promise<void> {
  await db.citationProjects.update(id, { name });
}

export async function setProjectStyle(id: number, style: CitationStyleId): Promise<void> {
  await db.citationProjects.update(id, { style });
}

/**
 * Deletes a project and every source in it. The last project is emptied
 * rather than removed, for the same reason the GPA calculator keeps its last
 * semester: a page with nothing to add to is a step with no purpose.
 *
 * Returns the id of the project that remains selected.
 */
export async function deleteProject(id: number, fallbackName: string): Promise<number> {
  return db.transaction("rw", db.citationProjects, db.citations, async () => {
    await db.citations.where("projectId").equals(id).delete();

    const others = await db.citationProjects.filter((project) => project.id !== id).first();
    if (!others) {
      await db.citationProjects.update(id, { name: fallbackName });
      return id;
    }
    await db.citationProjects.delete(id);
    return others.id;
  });
}

/** Stored ids and item ids are kept equal; see the module comment. */
function withId(item: CslItem, id: number): CslItem {
  return { ...item, id: String(id) };
}

export async function addCitation(projectId: number, item: CslItem): Promise<number> {
  return db.transaction("rw", db.citations, async () => {
    const now = Date.now();
    const id = await db.citations.add({ projectId, createdAt: now, updatedAt: now, item });
    await db.citations.update(id, { item: withId(item, id) });
    return id;
  });
}

export async function updateCitation(id: number, item: CslItem): Promise<void> {
  await db.citations.update(id, { item: withId(item, id), updatedAt: Date.now() });
}

/** Returns what was deleted, so the page can offer to put it back. */
export async function deleteCitation(id: number): Promise<CitationRecord | undefined> {
  return db.transaction("rw", db.citations, async () => {
    const record = await db.citations.get(id);
    if (record) await db.citations.delete(id);
    return record;
  });
}

/** Undoes a delete, keeping the original id and position. */
export async function restoreCitation(record: CitationRecord): Promise<void> {
  await db.citations.put(record);
}

export function projectCitations(projectId: number): Promise<CitationRecord[]> {
  return db.citations.where("projectId").equals(projectId).sortBy("createdAt");
}

export type { CitationProjectRecord, CitationRecord };
