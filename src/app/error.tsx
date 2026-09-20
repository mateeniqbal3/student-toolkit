"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function ToolError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <div className="bg-destructive/10 text-destructive flex size-12 items-center justify-center rounded-xl">
        <TriangleAlert className="size-6" aria-hidden />
      </div>
      <h1 className="font-display text-2xl font-semibold">This tool hit a problem</h1>
      <p className="text-muted-foreground text-pretty">
        Nothing you saved has been lost. Your notes, grades and timetables are stored in this
        browser and are untouched by this error.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>
          <RotateCcw className="size-4" aria-hidden />
          Try again
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">Back to all tools</Link>
        </Button>
      </div>
    </main>
  );
}
