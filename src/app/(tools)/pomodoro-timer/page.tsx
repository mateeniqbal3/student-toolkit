import { notFound } from "next/navigation";

import { PomodoroTimer } from "@/components/pomodoro/pomodoro-timer";
import { ToolShell } from "@/components/tool-shell";
import { toolMetadata } from "@/lib/tool-metadata";
import { getTool } from "@/lib/tools";

const SLUG = "pomodoro-timer";

export const metadata = toolMetadata(SLUG);

export default function Page() {
  const tool = getTool(SLUG);
  if (!tool) notFound();

  return (
    <ToolShell tool={tool}>
      <PomodoroTimer />
    </ToolShell>
  );
}
