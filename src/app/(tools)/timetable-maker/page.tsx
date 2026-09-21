import { notFound } from "next/navigation";

import { TimetableMaker } from "@/components/timetable/timetable-maker";
import { ToolShell } from "@/components/tool-shell";
import { toolMetadata } from "@/lib/tool-metadata";
import { getTool } from "@/lib/tools";

const SLUG = "timetable-maker";

export const metadata = toolMetadata(SLUG);

export default function Page() {
  const tool = getTool(SLUG);
  if (!tool) notFound();

  return (
    <ToolShell tool={tool}>
      <TimetableMaker />
    </ToolShell>
  );
}
