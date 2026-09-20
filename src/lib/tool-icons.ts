import {
  Calculator,
  CalendarDays,
  FileText,
  NotebookPen,
  Percent,
  Quote,
  Ruler,
  Sparkles,
  Timer,
  type LucideIcon,
} from "lucide-react";

/**
 * Icons live apart from the tool registry on purpose.
 *
 * The registry is imported by client components such as the mobile navigation.
 * Anything it references is therefore pulled into the browser bundle, and
 * bundling all nine icon components cost roughly 15KB gzipped on every route.
 * Icons are only ever drawn by server components, so keeping them in a
 * separate module keeps them out of the client entirely.
 */
export const TOOL_ICONS: Record<string, LucideIcon> = {
  "gpa-calculator": Calculator,
  "percentage-calculator": Percent,
  "unit-converter": Ruler,
  "citation-generator": Quote,
  "timetable-maker": CalendarDays,
  "pomodoro-timer": Timer,
  notes: NotebookPen,
  "pdf-tools": FileText,
  "ai-assistant": Sparkles,
};
