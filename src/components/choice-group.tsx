"use client";

import { useId } from "react";

import { cn } from "@/lib/utils";

/**
 * A small set of mutually exclusive options as a row of pressed buttons,
 * wrapping on narrow screens. Used for the handful of choices each PDF
 * operation has, where a dropdown would hide them.
 */
export function ChoiceGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <p id={id} className="text-muted-foreground text-xs">
        {label}
      </p>
      <div role="group" aria-labelledby={id} className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm transition-colors",
              "aria-pressed:border-primary aria-pressed:bg-primary/10 aria-pressed:text-foreground aria-pressed:font-medium",
              "text-muted-foreground hover:bg-muted",
            )}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
