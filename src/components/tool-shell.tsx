import { ArrowLeft, WifiOff, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TOOL_ICONS } from "@/lib/tool-icons";
import type { Tool } from "@/lib/tools";
import { cn } from "@/lib/utils";

/**
 * The frame every finished tool sits in: the heading a search result lands on,
 * the offline promise, and the way back to the rest of the app.
 *
 * It is a server component, so the icon and all of this copy are rendered into
 * the HTML and cost the browser no JavaScript.
 */
export function ToolShell({
  tool,
  wide = false,
  heading,
  back,
  children,
}: {
  tool: Tool;
  /** For tools laid out in two panes, which need more than a reading width. */
  wide?: boolean;
  /** A page within a tool (one PDF operation) names itself instead of the tool. */
  heading?: { title: string; tagline: string; icon: LucideIcon };
  /** A way back to the tool from one of its pages, shown above the heading. */
  back?: { href: string; label: string };
  children: ReactNode;
}) {
  const Icon = heading?.icon ?? TOOL_ICONS[tool.slug];

  return (
    <main
      className={cn(
        "mx-auto flex w-full flex-1 flex-col gap-6 px-4 py-8 sm:py-10 print:max-w-none print:p-0",
        wide ? "max-w-6xl" : "max-w-4xl",
      )}
    >
      <header className="flex flex-col gap-3 print:hidden">
        {back ? (
          <Link
            href={back.href}
            className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1 text-sm"
          >
            <ArrowLeft className="size-3.5 rtl:rotate-180" aria-hidden />
            {back.label}
          </Link>
        ) : null}
        <div className="flex items-center gap-3">
          <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
            {Icon ? <Icon className="size-5" aria-hidden /> : null}
          </span>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            {heading?.title ?? tool.name}
          </h1>
        </div>

        <p className="text-muted-foreground text-pretty">{heading?.tagline ?? tool.tagline}</p>

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
