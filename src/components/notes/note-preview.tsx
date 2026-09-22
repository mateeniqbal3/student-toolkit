"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";

type Render = (markdown: string) => string;

/**
 * Rendered Markdown. The renderer arrives by dynamic import the first time a
 * preview is shown, and typing is deferred so a long note with a lot of maths
 * never makes the textarea lag.
 *
 * The HTML is safe to insert because of how the renderer is configured (raw
 * HTML escaped, script links refused, images and KaTeX's trusted commands
 * off); see `lib/notes/markdown.ts`.
 */
export function NotePreview({ markdown }: { markdown: string }) {
  const [render, setRender] = useState<Render | null>(null);
  const [failed, setFailed] = useState(false);
  const deferred = useDeferredValue(markdown);

  useEffect(() => {
    let active = true;
    import("./markdown-renderer")
      .then((module) => {
        if (active) setRender(() => module.renderMarkdown);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const html = useMemo(() => (render ? render(deferred) : null), [render, deferred]);

  if (failed) {
    return (
      <p className="text-muted-foreground text-sm">
        The preview could not load. Reconnect once and it will work offline from then on; your note
        is safe either way.
      </p>
    );
  }
  if (html === null) {
    return (
      <div aria-busy="true" className="flex flex-col gap-2">
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    );
  }
  if (!deferred.trim()) {
    return <p className="text-muted-foreground text-sm">Nothing to preview yet.</p>;
  }
  return <div className="note-prose" dangerouslySetInnerHTML={{ __html: html }} />;
}
