"use client";

import { Check, Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

/**
 * Picks one of several named collections — bibliographies, timetables — and
 * renames, creates, duplicates or deletes them. Creating or duplicating drops
 * straight into renaming, because "Timetable 3" is never the name anyone
 * wants.
 */
export function CollectionPicker({
  label,
  noun,
  items,
  selectedId,
  onSelect,
  onRename,
  onCreate,
  onDuplicate,
  onDelete,
}: {
  label: string;
  /** Lower-case, for button labels: "bibliography", "timetable". */
  noun: string;
  items: { id: number; name: string }[];
  selectedId: number;
  onSelect: (id: number) => void;
  onRename: (name: string) => void;
  onCreate: () => Promise<void>;
  onDuplicate?: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [renaming, setRenaming] = useState(false);
  const selected = items.find((item) => item.id === selectedId);

  return (
    <div className="flex flex-col gap-1.5">
      <Label
        htmlFor={renaming ? "collection-name" : "collection-select"}
        className="text-muted-foreground text-xs"
      >
        {label}
      </Label>
      <div className="flex gap-1">
        {renaming ? (
          <form
            className="flex min-w-0 flex-1 gap-1"
            onSubmit={(event) => {
              event.preventDefault();
              setRenaming(false);
            }}
          >
            <Input
              id="collection-name"
              className="h-9 min-w-0 flex-1"
              defaultValue={selected?.name}
              autoFocus
              onFocus={(event) => event.target.select()}
              onChange={(event) => {
                const name = event.target.value.trim();
                if (name) onRename(name);
              }}
              onBlur={() => setRenaming(false)}
            />
            <Button
              type="submit"
              variant="outline"
              size="icon"
              className="size-9 shrink-0"
              aria-label="Done renaming"
              // Keeps focus in the input, so its blur does not unmount this
              // button before the click lands.
              onMouseDown={(event) => event.preventDefault()}
            >
              <Check className="size-4" aria-hidden />
            </Button>
          </form>
        ) : (
          <>
            <div className="min-w-0 flex-1">
              <NativeSelect
                id="collection-select"
                className="h-9"
                value={String(selectedId)}
                onChange={(event) => onSelect(Number(event.target.value))}
              >
                {items.map((item) => (
                  <option key={item.id} value={String(item.id)}>
                    {item.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <IconButton label={`Rename this ${noun}`} onClick={() => setRenaming(true)}>
              <Pencil className="size-4" aria-hidden />
            </IconButton>
            <IconButton
              label={`New ${noun}`}
              onClick={async () => {
                await onCreate();
                setRenaming(true);
              }}
            >
              <Plus className="size-4" aria-hidden />
            </IconButton>
            {onDuplicate ? (
              <IconButton
                label={`Duplicate this ${noun}`}
                onClick={async () => {
                  await onDuplicate();
                  setRenaming(true);
                }}
              >
                <Copy className="size-4" aria-hidden />
              </IconButton>
            ) : null}
            <IconButton label={`Delete this ${noun}`} onClick={() => void onDelete()}>
              <Trash2 className="size-4" aria-hidden />
            </IconButton>
          </>
        )}
      </div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void | Promise<void>;
  children: ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-9 shrink-0"
      aria-label={label}
      title={label}
      onClick={() => void onClick()}
    >
      {children}
    </Button>
  );
}
