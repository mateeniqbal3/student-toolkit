/**
 * Which notes the list shows. Stored as a string — "all", "unfiled",
 * "trash" or "folder:12" — so it can be remembered between visits.
 */
export type NotesView = "all" | "unfiled" | "trash" | `folder:${number}`;

const FOLDER_PREFIX = "folder:";

export function parseView(value: string): NotesView {
  if (value === "unfiled" || value === "trash") return value;
  const match = /^folder:(\d+)$/.exec(value);
  return match ? `folder:${Number(match[1])}` : "all";
}

export function viewFolderId(view: NotesView): number | null {
  return view.startsWith(FOLDER_PREFIX) ? Number(view.slice(FOLDER_PREFIX.length)) : null;
}
