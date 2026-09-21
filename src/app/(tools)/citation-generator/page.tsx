import { notFound } from "next/navigation";

import { CitationGenerator } from "@/components/citation/citation-generator";
import { ToolShell } from "@/components/tool-shell";
import { toolMetadata } from "@/lib/tool-metadata";
import { getTool } from "@/lib/tools";

const SLUG = "citation-generator";

export const metadata = toolMetadata(SLUG);

export default function Page() {
  const tool = getTool(SLUG);
  if (!tool) notFound();

  return (
    <ToolShell tool={tool}>
      <CitationGenerator />
    </ToolShell>
  );
}
