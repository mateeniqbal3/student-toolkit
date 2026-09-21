import { notFound } from "next/navigation";

import { ToolShell } from "@/components/tool-shell";
import { UnitConverter } from "@/components/units/unit-converter";
import { toolMetadata } from "@/lib/tool-metadata";
import { getTool } from "@/lib/tools";

const SLUG = "unit-converter";

export const metadata = toolMetadata(SLUG);

export default function Page() {
  const tool = getTool(SLUG);
  if (!tool) notFound();

  return (
    <ToolShell tool={tool}>
      <UnitConverter />
    </ToolShell>
  );
}
