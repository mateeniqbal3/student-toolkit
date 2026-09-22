import { notFound } from "next/navigation";

import { AiAssistant } from "@/components/ai/ai-assistant";
import { ToolShell } from "@/components/tool-shell";
import { toolMetadata } from "@/lib/tool-metadata";
import { getTool } from "@/lib/tools";

const SLUG = "ai-assistant";

export const metadata = toolMetadata(SLUG);

export default function Page() {
  const tool = getTool(SLUG);
  if (!tool) notFound();

  return (
    <ToolShell tool={tool}>
      <AiAssistant />
    </ToolShell>
  );
}
