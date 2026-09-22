"use client";

import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { addFolder, deleteFolder, updateFolder, type NoteFolderRecord } from "@/lib/db/notes";
import { wouldCycle, type FolderRow } from "@/lib/notes/folders";

/**
 * Create, rename, move and delete folders. Deleting a folder never deletes
 * notes: they move up to the folder's parent.
 */
export function FolderManager({
  rows,
  folders,
}: {
  rows: FolderRow<NoteFolderRecord>[];
  folders: NoteFolderRecord[];
}) {
  const [name, setName] = useState("");
  const [parent, setParent] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);

  async function create(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const parentId = Number.parseInt(parent, 10);
    await addFolder(trimmed, Number.isSafeInteger(parentId) ? parentId : null);
    setName((current) => (current === name ? "" : current));
  }

  return (
    <div className="flex flex-col gap-3 border-t p-3">
      <form className="flex flex-col gap-2" onSubmit={(event) => void create(event)}>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-folder" className="text-muted-foreground text-xs">
            New folder
          </Label>
          <Input
            id="new-folder"
            className="h-9"
            placeholder="e.g. Organic Chemistry"
            autoComplete="off"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        {rows.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-folder-parent" className="text-muted-foreground text-xs">
              Inside
            </Label>
            <NativeSelect
              id="new-folder-parent"
              className="h-9"
              value={parent}
              onChange={(event) => setParent(event.target.value)}
            >
              <option value="">Top level</option>
              {rows.map(({ folder, depth }) => (
                <option key={folder.id} value={folder.id}>
                  {"  ".repeat(depth)}
                  {folder.name}
                </option>
              ))}
            </NativeSelect>
          </div>
        ) : null}
        <Button type="submit" size="sm" className="w-fit" disabled={!name.trim()}>
          <Plus className="size-3.5" aria-hidden />
          Add folder
        </Button>
      </form>

      {rows.length > 0 ? (
        <ul aria-label="Folders" className="flex flex-col">
          {rows.map(({ folder, depth }) =>
            editingId === folder.id ? (
              <li key={folder.id} className="py-1">
                <FolderEditor
                  folder={folder}
                  rows={rows}
                  folders={folders}
                  onDone={() => setEditingId(null)}
                />
              </li>
            ) : (
              <li
                key={folder.id}
                className="flex items-center gap-1 py-0.5 text-sm"
                style={{ paddingInlineStart: `${depth * 0.75}rem` }}
              >
                <span className="min-w-0 flex-1 truncate">{folder.name}</span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Edit folder ${folder.name}`}
                  onClick={() => setEditingId(folder.id)}
                >
                  <Pencil className="size-3.5" aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete folder ${folder.name}`}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Delete the folder “${folder.name}”? Its notes and folders move up a level; nothing is deleted.`,
                      )
                    ) {
                      void deleteFolder(folder.id);
                    }
                  }}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </Button>
              </li>
            ),
          )}
        </ul>
      ) : null}
    </div>
  );
}

function FolderEditor({
  folder,
  rows,
  folders,
  onDone,
}: {
  folder: NoteFolderRecord;
  rows: FolderRow<NoteFolderRecord>[];
  folders: NoteFolderRecord[];
  onDone: () => void;
}) {
  const [name, setName] = useState(folder.name);
  const [parent, setParent] = useState(folder.parentId === null ? "" : String(folder.parentId));
  // A folder cannot go inside itself or anything inside it.
  const options = rows.filter((row) => !wouldCycle(folders, folder.id, row.folder.id));

  async function save(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const parentId = Number.parseInt(parent, 10);
    await updateFolder(folder.id, {
      name: trimmed,
      parentId: Number.isSafeInteger(parentId) ? parentId : null,
    });
    onDone();
  }

  return (
    <form
      className="bg-muted flex flex-col gap-2 rounded-lg p-2"
      onSubmit={(event) => void save(event)}
    >
      <Input
        aria-label="Folder name"
        className="bg-background h-8"
        value={name}
        autoFocus
        onChange={(event) => setName(event.target.value)}
      />
      <NativeSelect
        aria-label="Inside"
        className="bg-background h-8"
        value={parent}
        onChange={(event) => setParent(event.target.value)}
      >
        <option value="">Top level</option>
        {options.map(({ folder: option, depth }) => (
          <option key={option.id} value={option.id}>
            {"  ".repeat(depth)}
            {option.name}
          </option>
        ))}
      </NativeSelect>
      <div className="flex gap-1">
        <Button type="submit" size="sm" disabled={!name.trim()}>
          <Check className="size-3.5" aria-hidden />
          Save
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          <X className="size-3.5" aria-hidden />
          Cancel
        </Button>
      </div>
    </form>
  );
}
