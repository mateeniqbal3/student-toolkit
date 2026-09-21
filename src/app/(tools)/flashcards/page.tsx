import { notFound } from "next/navigation";

import { Flashcards } from "@/components/flashcards/flashcards";
import { ToolShell } from "@/components/tool-shell";
import { toolMetadata } from "@/lib/tool-metadata";
import { getTool } from "@/lib/tools";

const SLUG = "flashcards";

export const metadata = toolMetadata(SLUG);

export default function Page() {
  const tool = getTool(SLUG);
  if (!tool) notFound();

  return (
    <ToolShell tool={tool}>
      <Flashcards />
    </ToolShell>
  );
}
