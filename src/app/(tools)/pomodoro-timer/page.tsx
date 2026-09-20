import { notFound } from "next/navigation";

import { ToolPlaceholder } from "@/components/tool-placeholder";
import { toolMetadata } from "@/lib/tool-metadata";
import { getTool } from "@/lib/tools";

const SLUG = "pomodoro-timer";

export const metadata = toolMetadata(SLUG);

export default function Page() {
  const tool = getTool(SLUG);
  if (!tool) notFound();

  return <ToolPlaceholder tool={tool} />;
}
