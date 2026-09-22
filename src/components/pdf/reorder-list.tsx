"use client";

import { ArrowDown, ArrowUp, X } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length) return [...items];
  const next = [...items];
  const [item] = next.splice(from, 1);
  if (item !== undefined) next.splice(to, 0, item);
  return next;
}

/**
 * An ordered list of files with buttons to move and remove each one.
 * Buttons rather than drag and drop: they work the same with a thumb, a
 * mouse, a keyboard or a screen reader.
 */
export function ReorderList<T extends { id: string }>({
  label,
  items,
  describe,
  render,
  onChange,
}: {
  label: string;
  items: T[];
  /** A short name for the item, for button labels. */
  describe: (item: T) => string;
  render: (item: T, index: number) => ReactNode;
  onChange: (items: T[]) => void;
}) {
  return (
    <ol aria-label={label} className="flex flex-col gap-2">
      {items.map((item, index) => (
        <li
          key={item.id}
          className="bg-card ring-foreground/10 flex items-center gap-2 rounded-xl p-2 ring-1"
        >
          <span className="text-muted-foreground w-6 shrink-0 text-center text-sm tabular-nums">
            {index + 1}
          </span>
          <div className="min-w-0 flex-1">{render(item, index)}</div>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Move ${describe(item)} up`}
            disabled={index === 0}
            onClick={() => onChange(moveItem(items, index, index - 1))}
          >
            <ArrowUp className="size-4" aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Move ${describe(item)} down`}
            disabled={index === items.length - 1}
            onClick={() => onChange(moveItem(items, index, index + 1))}
          >
            <ArrowDown className="size-4" aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Remove ${describe(item)}`}
            onClick={() => onChange(items.filter((_, position) => position !== index))}
          >
            <X className="size-4" aria-hidden />
          </Button>
        </li>
      ))}
    </ol>
  );
}
