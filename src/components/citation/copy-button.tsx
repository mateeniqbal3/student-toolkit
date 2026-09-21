"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState, type ComponentProps } from "react";

import { Button } from "@/components/ui/button";

import { copyToClipboard } from "./clipboard";

/**
 * A button that says "Copied" for a moment after it works. The copy is
 * produced on click rather than passed in, so a large reference list is only
 * serialised when someone actually wants it.
 */
export function CopyButton({
  getContent,
  label,
  copiedLabel = "Copied",
  iconOnly = false,
  ...props
}: {
  getContent: () => { text: string; html?: string };
  label: string;
  copiedLabel?: string;
  iconOnly?: boolean;
} & Omit<ComponentProps<typeof Button>, "onClick" | "children">) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (state === "idle") return;
    const timer = window.setTimeout(() => setState("idle"), 2000);
    return () => window.clearTimeout(timer);
  }, [state]);

  const text = state === "copied" ? copiedLabel : state === "failed" ? "Copy blocked" : label;
  const Icon = state === "copied" ? Check : Copy;

  return (
    <Button
      {...props}
      aria-label={iconOnly ? text : props["aria-label"]}
      title={iconOnly ? text : undefined}
      onClick={async () => {
        const { text: plain, html } = getContent();
        setState((await copyToClipboard(plain, html)) ? "copied" : "failed");
      }}
    >
      <Icon className="size-4" aria-hidden />
      {iconOnly ? null : text}
    </Button>
  );
}
