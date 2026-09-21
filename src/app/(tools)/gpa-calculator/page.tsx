import { notFound } from "next/navigation";

import { GpaCalculator } from "@/components/gpa/gpa-calculator";
import { ToolShell } from "@/components/tool-shell";
import { toolMetadata } from "@/lib/tool-metadata";
import { getTool } from "@/lib/tools";

const SLUG = "gpa-calculator";

export const metadata = toolMetadata(SLUG);

export default function Page() {
  const tool = getTool(SLUG);
  if (!tool) notFound();

  return (
    <ToolShell tool={tool}>
      <GpaCalculator />
    </ToolShell>
  );
}
