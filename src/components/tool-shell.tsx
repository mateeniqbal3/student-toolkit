import { ArrowLeft, WifiOff } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TOOL_ICONS } from "@/lib/tool-icons";
import type { Tool } from "@/lib/tools";

/**
 * The frame every finished tool sits in: the heading a search result lands on,
 * the offline promise, and the way back to the rest of the app.
 *
 * It is a server component, so the icon and all of this copy are rendered into
 * the HTML and cost the browser no JavaScript.
 */
export function ToolShell({ tool, children }: { tool: Tool; children: ReactNode }) {
  const Icon = TOOL_ICONS[tool.slug];

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-8 sm:py-10 print:max-w-none print:p-0">
      <header className="flex flex-col gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
            <Icon className="size-5" aria-hidden />
          </span>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            {tool.name}
          </h1>
        </div>

        <p className="text-muted-foreground text-pretty">{tool.tagline}</p>

        {tool.offline ? (
          <Badge variant="secondary" className="w-fit gap-1.5">
            <WifiOff className="size-3.5" aria-hidden />
            Works offline · nothing leaves your device
          </Badge>
        ) : null}
      </header>

      {children}

      <Button variant="ghost" asChild className="mt-2 w-fit print:hidden">
        <Link href="/">
          <ArrowLeft className="size-4" aria-hidden />
          All tools
        </Link>
      </Button>
    </main>
  );
}
