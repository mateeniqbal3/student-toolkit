import { ArrowLeft, WifiOff } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TOOL_ICONS } from "@/lib/tool-icons";
import type { Tool } from "@/lib/tools";

export function ToolPlaceholder({ tool }: { tool: Tool }) {
  const Icon = TOOL_ICONS[tool.slug];

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-4">
        <div className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-xl">
          <Icon className="size-6" aria-hidden />
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-balance">
            {tool.name}
          </h1>
          <p className="text-muted-foreground text-lg text-pretty">{tool.tagline}</p>
        </div>

        {tool.offline ? (
          <Badge variant="secondary" className="w-fit gap-1.5">
            <WifiOff className="size-3.5" aria-hidden />
            Works offline
          </Badge>
        ) : null}
      </div>

      <div className="bg-muted/60 rounded-xl border border-dashed p-6">
        <h2 className="font-display text-base font-semibold">Being built now</h2>
        <p className="text-muted-foreground mt-2 text-sm text-pretty">{tool.description}</p>
      </div>

      <Button variant="ghost" asChild className="w-fit">
        <Link href="/">
          <ArrowLeft className="size-4" aria-hidden />
          All tools
        </Link>
      </Button>
    </main>
  );
}
