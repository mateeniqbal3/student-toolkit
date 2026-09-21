import { downloadBlob } from "@/components/download";
import { canvasSize, drawTimetable, type DrawOptions } from "@/lib/timetable/draw";
import { COURSE_COLOURS, type CourseColour } from "@/lib/timetable/types";

/** The PNG is drawn at twice its layout size, so it stays sharp on a phone screen. */
const SCALE = 2;

/**
 * Renders the week to a PNG and downloads it. Colours are read from the live
 * theme tokens, so the image matches what is on screen in either theme.
 */
export async function exportTimetablePng(
  options: Omit<DrawOptions, "palette" | "fontFamily">,
  filename: string,
): Promise<boolean> {
  const styles = getComputedStyle(document.documentElement);
  const token = (name: string) => styles.getPropertyValue(name).trim();

  const course = Object.fromEntries(
    COURSE_COLOURS.map((colour) => [colour, token(`--course-${colour}`)]),
  ) as Record<CourseColour, string>;

  const { width, height } = canvasSize(options);
  const canvas = document.createElement("canvas");
  canvas.width = width * SCALE;
  canvas.height = height * SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  ctx.scale(SCALE, SCALE);

  drawTimetable(ctx, {
    ...options,
    fontFamily: getComputedStyle(document.body).fontFamily,
    palette: {
      background: token("--card"),
      foreground: token("--foreground"),
      muted: token("--muted-foreground"),
      border: token("--border"),
      clash: token("--destructive"),
      course,
    },
  });

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) return false;
  downloadBlob(filename, blob);
  return true;
}
