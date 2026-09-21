import { notFound } from "next/navigation";

import { PercentageCalculator } from "@/components/percentage/percentage-calculator";
import { ToolShell } from "@/components/tool-shell";
import { toolMetadata } from "@/lib/tool-metadata";
import { getTool } from "@/lib/tools";

const SLUG = "percentage-calculator";

export const metadata = toolMetadata(SLUG);

export default function Page() {
  const tool = getTool(SLUG);
  if (!tool) notFound();

  return (
    <ToolShell tool={tool}>
      <PercentageCalculator />
    </ToolShell>
  );
}
