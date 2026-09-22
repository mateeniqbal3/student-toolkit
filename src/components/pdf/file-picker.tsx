"use client";

import { FileUp } from "lucide-react";
import { useId, useState, type DragEvent } from "react";

import { cn } from "@/lib/utils";

/**
 * A large target to tap or drop files on. On a phone it opens the file
 * picker (or the camera roll, for images); on a laptop files can be dragged
 * in. Nothing is uploaded: the files are only read by this page.
 */
export function FilePicker({
  accept,
  multiple = false,
  label,
  hint,
  compact = false,
  onFiles,
}: {
  accept: string;
  multiple?: boolean;
  label: string;
  hint?: string;
  /** A slim button-sized target, for adding more once files are chosen. */
  compact?: boolean;
  onFiles: (files: File[]) => void;
}) {
  const id = useId();
  const [dragging, setDragging] = useState(false);

  function drop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    const files = [...event.dataTransfer.files];
    if (files.length > 0) onFiles(multiple ? files : files.slice(0, 1));
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={drop}
    >
      <input
        id={id}
        type="file"
        accept={accept}
        multiple={multiple}
        className="peer sr-only"
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          event.target.value = "";
          if (files.length > 0) onFiles(files);
        }}
      />
      <label
        htmlFor={id}
        className={cn(
          "peer-focus-visible:outline-ring flex cursor-pointer items-center justify-center gap-3 rounded-xl border-2 border-dashed text-center transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2",
          compact ? "px-4 py-3 text-sm" : "min-h-40 flex-col px-6 py-8",
          dragging ? "border-primary bg-primary/5" : "hover:border-primary/60 hover:bg-muted/50",
        )}
      >
        <FileUp className={cn("text-primary", compact ? "size-4" : "size-8")} aria-hidden />
        <span className="flex flex-col gap-1">
          <span className="font-medium">{label}</span>
          {hint && !compact ? (
            <span className="text-muted-foreground text-sm text-pretty">{hint}</span>
          ) : null}
        </span>
      </label>
    </div>
  );
}
