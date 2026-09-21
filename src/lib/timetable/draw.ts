/**
 * Draws a timetable onto a canvas, for the PNG export.
 *
 * The grid is drawn directly rather than screenshotting the page with a
 * library such as html2canvas. That library is around 45KB and reproduces
 * CSS imperfectly; a timetable is rectangles and text, which the canvas API
 * draws exactly and for nothing. The export also comes out the same whatever
 * the screen size — a phone gets the full week, not its one-day view.
 *
 * Colours and labels are passed in, so this module stays free of the DOM's
 * stylesheet and of user-facing copy.
 */
import { layoutDay } from "./schedule";
import { formatRange, formatTime, type ClockFormat } from "./time";
import type { CourseColour, DayIndex, TimetableEntry } from "./types";

export interface DrawPalette {
  background: string;
  foreground: string;
  muted: string;
  border: string;
  clash: string;
  course: Record<CourseColour, string>;
}

export interface DrawOptions {
  title: string;
  entries: readonly TimetableEntry[];
  days: readonly DayIndex[];
  dayLabel: (day: DayIndex) => string;
  range: { start: number; end: number };
  clock: ClockFormat;
  palette: DrawPalette;
  fontFamily: string;
  clashIds: ReadonlySet<string>;
}

const WIDTH = 1400;
const PADDING = 32;
const TITLE_HEIGHT = 56;
const HEADER_HEIGHT = 36;
const GUTTER = 72;
const HOUR_HEIGHT = 72;

export function canvasSize(options: Pick<DrawOptions, "range">): { width: number; height: number } {
  const hours = (options.range.end - options.range.start) / 60;
  return {
    width: WIDTH,
    height: PADDING * 2 + TITLE_HEIGHT + HEADER_HEIGHT + hours * HOUR_HEIGHT,
  };
}

/** Where an entry's block goes, in canvas pixels. Exported for its test. */
export function blockRect(
  options: Pick<DrawOptions, "days" | "range">,
  entry: Pick<TimetableEntry, "day" | "start" | "end">,
  lane: number,
  lanes: number,
): { x: number; y: number; width: number; height: number } | null {
  const column = options.days.indexOf(entry.day);
  if (column === -1) return null;

  const columnWidth = (WIDTH - PADDING * 2 - GUTTER) / options.days.length;
  const laneWidth = columnWidth / lanes;
  const top = PADDING + TITLE_HEIGHT + HEADER_HEIGHT;
  const minuteHeight = HOUR_HEIGHT / 60;

  return {
    x: PADDING + GUTTER + column * columnWidth + lane * laneWidth + 2,
    y: top + (entry.start - options.range.start) * minuteHeight + 1,
    width: laneWidth - 4,
    height: (entry.end - entry.start) * minuteHeight - 2,
  };
}

/** Shortens text with an ellipsis until it fits. */
function fit(ctx: CanvasRenderingContext2D, text: string, width: number): string {
  if (ctx.measureText(text).width <= width) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > width) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

export function drawTimetable(ctx: CanvasRenderingContext2D, options: DrawOptions): void {
  const { palette, range, days, fontFamily } = options;
  const { width, height } = canvasSize(options);
  const top = PADDING + TITLE_HEIGHT + HEADER_HEIGHT;
  const columnWidth = (width - PADDING * 2 - GUTTER) / days.length;

  ctx.fillStyle = palette.background;
  ctx.fillRect(0, 0, width, height);
  ctx.textBaseline = "top";

  ctx.fillStyle = palette.foreground;
  ctx.font = `600 26px ${fontFamily}`;
  ctx.fillText(fit(ctx, options.title, width - PADDING * 2), PADDING, PADDING);

  // Day names.
  ctx.font = `600 15px ${fontFamily}`;
  ctx.textAlign = "center";
  days.forEach((day, index) => {
    ctx.fillText(
      options.dayLabel(day),
      PADDING + GUTTER + columnWidth * (index + 0.5),
      PADDING + TITLE_HEIGHT + 8,
    );
  });

  // Hour lines and labels.
  ctx.textAlign = "right";
  ctx.font = `13px ${fontFamily}`;
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 1;
  for (let minute = range.start; minute <= range.end; minute += 60) {
    const y = Math.round(top + ((minute - range.start) / 60) * HOUR_HEIGHT) + 0.5;
    ctx.beginPath();
    ctx.moveTo(PADDING + GUTTER, y);
    ctx.lineTo(width - PADDING, y);
    ctx.stroke();
    if (minute < range.end) {
      ctx.fillStyle = palette.muted;
      ctx.fillText(formatTime(minute, options.clock), PADDING + GUTTER - 10, y + 4);
    }
  }

  // Column dividers.
  for (let index = 0; index <= days.length; index += 1) {
    const x = Math.round(PADDING + GUTTER + index * columnWidth) + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, height - PADDING);
    ctx.stroke();
  }

  // Classes.
  ctx.textAlign = "left";
  for (const day of days) {
    const placed = layoutDay(options.entries.filter((entry) => entry.day === day));
    for (const { entry, lane, lanes } of placed) {
      const rect = blockRect(options, entry, lane, lanes);
      if (!rect) continue;
      const colour = palette.course[entry.colour];

      ctx.save();
      roundedRect(ctx, rect.x, rect.y, rect.width, rect.height, 6);
      ctx.fillStyle = palette.background;
      ctx.fill();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = colour;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.clip();

      ctx.fillStyle = colour;
      ctx.fillRect(rect.x, rect.y, 4, rect.height);

      if (options.clashIds.has(entry.id)) {
        ctx.strokeStyle = palette.clash;
        ctx.lineWidth = 3;
        roundedRect(ctx, rect.x + 1.5, rect.y + 1.5, rect.width - 3, rect.height - 3, 5);
        ctx.stroke();
      }

      const textX = rect.x + 12;
      const textWidth = rect.width - 18;
      let y = rect.y + 8;
      const lines: [string, string, string][] = [
        [entry.title, `600 15px ${fontFamily}`, palette.foreground],
        [formatRange(entry.start, entry.end, options.clock), `13px ${fontFamily}`, palette.muted],
        [entry.location, `13px ${fontFamily}`, palette.muted],
      ];
      for (const [text, font, fill] of lines) {
        if (!text.trim() || y + 16 > rect.y + rect.height) continue;
        ctx.font = font;
        ctx.fillStyle = fill;
        ctx.fillText(fit(ctx, text, textWidth), textX, y);
        y += 20;
      }
      ctx.restore();
    }
  }
}
