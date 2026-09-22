"use client";

import { useId } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RangeError, RangeResult } from "@/lib/pdf/ranges";

export function rangeErrorMessage(error: RangeError): string {
  switch (error.kind) {
    case "empty":
      return "Type the pages you want, such as 1-3, 5.";
    case "invalid":
      return `“${error.token}” is not a page or a range. Use numbers such as 2 or 4-7.`;
    case "out-of-range":
      return `“${error.token}” is outside this PDF, which has ${error.pageCount} ${error.pageCount === 1 ? "page" : "pages"}.`;
    case "backwards":
      return `“${error.token}” runs backwards. Put the smaller number first.`;
  }
}

/** A page-range field that says what is wrong while it is being typed. */
export function RangeInput({
  label,
  value,
  result,
  hint,
  onChange,
}: {
  label: string;
  value: string;
  result: RangeResult;
  hint: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const showError = !result.ok && value.trim() !== "";
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-muted-foreground text-xs">
        {label}
      </Label>
      <Input
        id={id}
        className="h-10 font-mono"
        inputMode="numeric"
        autoComplete="off"
        placeholder="1-3, 5, 8-"
        value={value}
        aria-invalid={showError}
        aria-describedby={`${id}-help`}
        onChange={(event) => onChange(event.target.value)}
      />
      <p
        id={`${id}-help`}
        className={showError ? "text-destructive text-xs" : "text-muted-foreground text-xs"}
      >
        {!result.ok && showError ? rangeErrorMessage(result.error) : hint}
      </p>
    </div>
  );
}
