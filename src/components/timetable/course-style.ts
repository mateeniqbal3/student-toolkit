import type { CSSProperties } from "react";

import type { CourseColour } from "@/lib/timetable/types";

type WithCssVariables = CSSProperties & Record<`--${string}`, string>;

/**
 * Points `--entry` at one of the course colour tokens. Components then style
 * with `var(--entry)` from static class names, so Tailwind sees every class
 * at build time and the colours still come from the theme.
 */
export function courseStyle(colour: CourseColour): WithCssVariables {
  return { "--entry": `var(--course-${colour})` };
}

/** A tint of the course colour over the card, with a solid edge. */
export const ENTRY_SURFACE =
  "print-exact border-s-4 border-[var(--entry)] bg-[color-mix(in_oklch,var(--entry)_16%,var(--card))]";
