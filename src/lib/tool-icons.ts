import {
  Calculator,
  CalendarDays,
  Combine,
  FileImage,
  FileText,
  Hash,
  Images,
  LayoutGrid,
  Layers,
  Minimize2,
  NotebookPen,
  Percent,
  Quote,
  Ruler,
  Scissors,
  Sparkles,
  Stamp,
  TextCursorInput,
  Timer,
  type LucideIcon,
} from "lucide-react";

import type { PdfOperationSlug } from "./pdf-tools";

/**
 * Icons live apart from the tool registry on purpose.
 *
 * The registry is imported by client components such as the mobile navigation.
 * Anything it references is therefore pulled into the browser bundle, and
 * bundling every icon component cost roughly 15KB gzipped on every route.
 * Icons are only ever drawn by server components, so keeping them in a
 * separate module keeps them out of the client entirely.
 */
export const TOOL_ICONS: Record<string, LucideIcon> = {
  "gpa-calculator": Calculator,
  "percentage-calculator": Percent,
  "unit-converter": Ruler,
  "citation-generator": Quote,
  "timetable-maker": CalendarDays,
  flashcards: Layers,
  "pomodoro-timer": Timer,
  notes: NotebookPen,
  "pdf-tools": FileText,
  "ai-assistant": Sparkles,
};

export const PDF_OPERATION_ICONS: Record<PdfOperationSlug, LucideIcon> = {
  merge: Combine,
  split: Scissors,
  organize: LayoutGrid,
  compress: Minimize2,
  "images-to-pdf": FileImage,
  "pdf-to-images": Images,
  "extract-text": TextCursorInput,
  "page-numbers": Hash,
  watermark: Stamp,
};
