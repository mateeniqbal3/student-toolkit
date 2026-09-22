/**
 * The folder tree. Folders are stored flat with a parent id; these functions
 * turn that into the indented list a picker shows and answer "what is inside
 * this folder" for filtering.
 */

export interface FolderLike {
  id: number;
  name: string;
  parentId: number | null;
}

export interface FolderRow<T extends FolderLike = FolderLike> {
  folder: T;
  /** 0 for a top-level folder. */
  depth: number;
}

/**
 * Depth-first, siblings alphabetical. A folder whose parent is missing is
 * shown at the top level rather than lost, and a cycle (which the editor
 * never creates, but a hand-edited backup could) is broken rather than
 * followed forever.
 */
export function folderRows<T extends FolderLike>(folders: readonly T[]): FolderRow<T>[] {
  const ids = new Set(folders.map((folder) => folder.id));
  const children = new Map<number | null, T[]>();
  for (const folder of folders) {
    const parent = folder.parentId !== null && ids.has(folder.parentId) ? folder.parentId : null;
    const siblings = children.get(parent);
    if (siblings) siblings.push(folder);
    else children.set(parent, [folder]);
  }
  for (const siblings of children.values()) {
    siblings.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }

  const rows: FolderRow<T>[] = [];
  const visited = new Set<number>();
  function visit(parent: number | null, depth: number) {
    for (const folder of children.get(parent) ?? []) {
      if (visited.has(folder.id)) continue;
      visited.add(folder.id);
      rows.push({ folder, depth });
      visit(folder.id, depth + 1);
    }
  }
  visit(null, 0);
  // Anything only reachable through a cycle is still listed, at the top.
  for (const folder of folders) {
    if (!visited.has(folder.id)) {
      visited.add(folder.id);
      rows.push({ folder, depth: 0 });
      visit(folder.id, 1);
    }
  }
  return rows;
}

/** The folder and everything nested inside it. */
export function descendantIds(folders: readonly FolderLike[], rootId: number): Set<number> {
  const result = new Set<number>([rootId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const folder of folders) {
      if (folder.parentId !== null && result.has(folder.parentId) && !result.has(folder.id)) {
        result.add(folder.id);
        grew = true;
      }
    }
  }
  return result;
}

/** Whether moving a folder under `parentId` would put it inside itself. */
export function wouldCycle(
  folders: readonly FolderLike[],
  folderId: number,
  parentId: number | null,
): boolean {
  return parentId !== null && descendantIds(folders, folderId).has(parentId);
}

/** "Year 2 / Biology / Genetics", for export and labels. */
export function folderPath(folders: readonly FolderLike[], folderId: number | null): string[] {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const path: string[] = [];
  const seen = new Set<number>();
  let current = folderId === null ? undefined : byId.get(folderId);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    path.unshift(current.name);
    current = current.parentId === null ? undefined : byId.get(current.parentId);
  }
  return path;
}
