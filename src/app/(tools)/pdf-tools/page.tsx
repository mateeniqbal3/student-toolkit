import { ChevronRight, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ToolShell } from "@/components/tool-shell";
import { PDF_OPERATIONS } from "@/lib/pdf-tools";
import { PDF_OPERATION_ICONS } from "@/lib/tool-icons";
import { toolMetadata } from "@/lib/tool-metadata";
import { getTool } from "@/lib/tools";

const SLUG = "pdf-tools";

export const metadata = toolMetadata(SLUG);

/** The hub: every PDF operation, each a link to its own page. Rendered on the server. */
export default function Page() {
  const tool = getTool(SLUG);
  if (!tool) notFound();

  return (
    <ToolShell tool={tool}>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PDF_OPERATIONS.map((operation) => {
          const Icon = PDF_OPERATION_ICONS[operation.slug];
          return (
            <li key={operation.slug}>
              <Link
                href={`/pdf-tools/${operation.slug}`}
                className="bg-card ring-foreground/10 hover:ring-primary/50 flex h-full items-start gap-3 rounded-xl p-4 ring-1 transition-shadow"
              >
                <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
                  <Icon className="size-4.5" aria-hidden />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="font-display font-semibold">{operation.name}</span>
                  <span className="text-muted-foreground text-sm text-pretty">
                    {operation.tagline}
                  </span>
                </span>
                <ChevronRight
                  className="text-muted-foreground mt-1 size-4 shrink-0 rtl:rotate-180"
                  aria-hidden
                />
              </Link>
            </li>
          );
        })}
      </ul>

      <p className="text-muted-foreground flex items-start gap-2 text-sm text-pretty">
        <ShieldCheck className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
        Most PDF sites upload your file to their servers. These tools open it in your browser
        instead, so coursework, transcripts and ID scans never leave your device, and they work with
        no connection.
      </p>
    </ToolShell>
  );
}
