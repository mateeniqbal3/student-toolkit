/**
 * Every PDF edit, as pure functions from bytes to bytes, with pdf-lib.
 *
 * They run in a Web Worker (see `src/workers/pdf.worker.ts`), so a 50MB
 * merge never freezes the page, and they import nothing from the browser, so
 * the unit tests run them on real PDFs in Node. Page indexes are 0-based
 * throughout; page numbers are only for people.
 */
import {
  EncryptedPDFError,
  PDFDocument,
  StandardFonts,
  degrees,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";

import { PdfError } from "./errors";

export { PdfError };

async function load(bytes: Uint8Array): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(bytes, { updateMetadata: false });
  } catch (error) {
    // Includes PDFs with only an "owner" password restricting editing, which
    // open without a prompt elsewhere but whose content pdf-lib cannot rewrite.
    if (error instanceof EncryptedPDFError) throw new PdfError("encrypted");
    throw new PdfError("invalid");
  }
}

async function create(): Promise<PDFDocument> {
  const doc = await PDFDocument.create();
  doc.setProducer("Student Toolkit");
  doc.setCreator("Student Toolkit");
  return doc;
}

export interface PdfInfo {
  pageCount: number;
}

export async function pdfInfo(bytes: Uint8Array): Promise<PdfInfo> {
  const doc = await load(bytes);
  return { pageCount: doc.getPageCount() };
}

/** One PDF from several, in the order given. */
export async function mergePdfs(files: readonly Uint8Array[]): Promise<Uint8Array> {
  const output = await create();
  for (const bytes of files) {
    const source = await load(bytes);
    const pages = await output.copyPages(source, source.getPageIndices());
    for (const page of pages) output.addPage(page);
  }
  if (output.getPageCount() === 0) throw new PdfError("no-pages");
  return output.save();
}

async function copyInto(source: PDFDocument, indexes: readonly number[]): Promise<PDFDocument> {
  if (indexes.length === 0) throw new PdfError("no-pages");
  const output = await create();
  const pages = await output.copyPages(source, [...indexes]);
  for (const page of pages) output.addPage(page);
  return output;
}

/** A new PDF of the given pages, in the given order; repeats are allowed. */
export async function selectPages(
  bytes: Uint8Array,
  indexes: readonly number[],
): Promise<Uint8Array> {
  return (await copyInto(await load(bytes), indexes)).save();
}

/** Several PDFs from one, a group of page indexes each. The source is read once. */
export async function splitPdf(
  bytes: Uint8Array,
  groups: readonly (readonly number[])[],
): Promise<Uint8Array[]> {
  const source = await load(bytes);
  const outputs: Uint8Array[] = [];
  for (const group of groups) outputs.push(await (await copyInto(source, group)).save());
  return outputs;
}

export interface PagePlan {
  /** 0-based index in the source. */
  index: number;
  /** Extra clockwise turn, added to whatever the page already has. */
  rotation: 0 | 90 | 180 | 270;
}

/** Reorders, rotates and drops pages in one pass: pages not in the plan are deleted. */
export async function organizePages(
  bytes: Uint8Array,
  plan: readonly PagePlan[],
): Promise<Uint8Array> {
  const output = await copyInto(
    await load(bytes),
    plan.map((page) => page.index),
  );
  output.getPages().forEach((page, position) => {
    const turn = plan[position]?.rotation ?? 0;
    if (turn !== 0) page.setRotation(degrees((page.getRotation().angle + turn) % 360));
  });
  return output.save();
}

// --- Images ------------------------------------------------------------------

export interface EmbeddableImage {
  bytes: Uint8Array;
  format: "jpeg" | "png";
  /** Pixel size, which sets the page shape. */
  width: number;
  height: number;
}

export type PageSize = "fit" | "a4" | "letter";

export interface ImageLayout {
  pageSize: PageSize;
  /** Space around the image in points (1/72 inch). Ignored when the page fits the image. */
  margin: number;
}

const PAPER: Record<Exclude<PageSize, "fit">, [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
};

/**
 * A "fit" page takes the image's shape with its long side at A4's, so a
 * 4000-pixel phone photo makes a page that prints sensibly rather than a
 * poster a metre wide.
 */
const FIT_LONG_SIDE = 841.89;

/** One image per page, centred and scaled to fit, turning the paper to match the image. */
export async function imagesToPdf(
  images: readonly EmbeddableImage[],
  layout: ImageLayout,
): Promise<Uint8Array> {
  if (images.length === 0) throw new PdfError("no-pages");
  const output = await create();
  for (const image of images) {
    const embedded =
      image.format === "png"
        ? await output.embedPng(image.bytes)
        : await output.embedJpg(image.bytes);
    const landscape = image.width > image.height;

    let pageWidth: number;
    let pageHeight: number;
    let margin: number;
    if (layout.pageSize === "fit") {
      const scale = FIT_LONG_SIDE / Math.max(image.width, image.height);
      pageWidth = image.width * scale;
      pageHeight = image.height * scale;
      margin = 0;
    } else {
      const [short, long] = PAPER[layout.pageSize];
      [pageWidth, pageHeight] = landscape ? [long, short] : [short, long];
      margin = Math.max(0, Math.min(layout.margin, Math.min(pageWidth, pageHeight) / 4));
    }

    const boxWidth = pageWidth - 2 * margin;
    const boxHeight = pageHeight - 2 * margin;
    const scale = Math.min(boxWidth / image.width, boxHeight / image.height);
    const width = image.width * scale;
    const height = image.height * scale;

    const page = output.addPage([pageWidth, pageHeight]);
    page.drawImage(embedded, {
      x: (pageWidth - width) / 2,
      y: (pageHeight - height) / 2,
      width,
      height,
    });
  }
  return output.save();
}

export interface RasterPage {
  jpeg: Uint8Array;
  /** The original page's size in points, as seen (rotation applied). */
  width: number;
  height: number;
}

/** Rebuilds a PDF from page images at each page's original size: the strong compression. */
export async function pdfFromRasters(pages: readonly RasterPage[]): Promise<Uint8Array> {
  if (pages.length === 0) throw new PdfError("no-pages");
  const output = await create();
  for (const raster of pages) {
    const image = await output.embedJpg(raster.jpeg);
    const page = output.addPage([raster.width, raster.height]);
    page.drawImage(image, { x: 0, y: 0, width: raster.width, height: raster.height });
  }
  return output.save();
}

/** Loads and saves again with object streams, which alone often saves a little. */
export async function compressLossless(bytes: Uint8Array): Promise<Uint8Array> {
  const doc = await load(bytes);
  return doc.save({ useObjectStreams: true });
}

// --- Stamping text -------------------------------------------------------------

/**
 * Where a point that should appear at (x, y) on screen lies in the page's own
 * coordinates. A page with a /Rotate is drawn in unrotated space and turned
 * for display, so text meant for "the bottom" of a scanned-sideways page has
 * to be placed on what is, internally, its side.
 */
export function toPageSpace(
  visual: { x: number; y: number },
  box: { x: number; y: number; width: number; height: number },
  rotation: number,
): { x: number; y: number } {
  const turn = ((rotation % 360) + 360) % 360;
  const { width: w, height: h } = box;
  let x: number;
  let y: number;
  if (turn === 90) [x, y] = [w - visual.y, visual.x];
  else if (turn === 180) [x, y] = [w - visual.x, h - visual.y];
  else if (turn === 270) [x, y] = [visual.y, h - visual.x];
  else [x, y] = [visual.x, visual.y];
  return { x: x + box.x, y: y + box.y };
}

/** The page as the reader sees it: its visible size and rotation. */
function visualFrame(page: PDFPage) {
  const box = page.getCropBox();
  const rotation = ((page.getRotation().angle % 360) + 360) % 360;
  const sideways = rotation === 90 || rotation === 270;
  return {
    box,
    rotation,
    width: sideways ? box.height : box.width,
    height: sideways ? box.width : box.height,
  };
}

/** Standard fonts cover Latin text only; anything else is refused up front, not garbled. */
function checkEncodable(font: PDFFont, text: string): void {
  try {
    font.encodeText(text);
  } catch {
    throw new PdfError("unsupported-text");
  }
}

/**
 * Draws text so that, as the page is displayed, it starts at `start` and runs
 * at `angle` degrees anticlockwise from horizontal.
 */
function drawVisualText(
  page: PDFPage,
  text: string,
  options: {
    start: { x: number; y: number };
    angle: number;
    font: PDFFont;
    size: number;
    opacity: number;
    grey: number;
  },
): void {
  const frame = visualFrame(page);
  const point = toPageSpace(options.start, frame.box, frame.rotation);
  page.drawText(text, {
    x: point.x,
    y: point.y,
    size: options.size,
    font: options.font,
    color: rgb(options.grey, options.grey, options.grey),
    opacity: options.opacity,
    rotate: degrees(frame.rotation + options.angle),
  });
}

export type NumberPosition =
  "bottom-left" | "bottom-center" | "bottom-right" | "top-left" | "top-center" | "top-right";

export interface PageNumberOptions {
  position: NumberPosition;
  /**
   * The label, with {n} for the number and {total} for the count, such as
   * "Page {n} of {total}". It comes from the page so it can be translated.
   */
  template: string;
  /** The number shown on the first numbered page. */
  startAt: number;
  /** Leave the first page (a cover) unnumbered, and start counting on the second. */
  skipFirst: boolean;
  fontSize: number;
}

const EDGE = 28;

export async function addPageNumbers(
  bytes: Uint8Array,
  options: PageNumberOptions,
): Promise<Uint8Array> {
  const doc = await load(bytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  const numbered = options.skipFirst ? pages.slice(1) : pages;
  const total = numbered.length + options.startAt - 1;

  numbered.forEach((page, position) => {
    const label = options.template
      .replaceAll("{n}", String(options.startAt + position))
      .replaceAll("{total}", String(total));
    checkEncodable(font, label);

    const frame = visualFrame(page);
    const width = font.widthOfTextAtSize(label, options.fontSize);
    const [vertical, horizontal] = options.position.split("-");
    const x =
      horizontal === "left"
        ? EDGE
        : horizontal === "right"
          ? frame.width - EDGE - width
          : (frame.width - width) / 2;
    const y = vertical === "top" ? frame.height - EDGE - options.fontSize : EDGE;
    drawVisualText(page, label, {
      start: { x, y },
      angle: 0,
      font,
      size: options.fontSize,
      opacity: 1,
      grey: 0.2,
    });
  });
  return doc.save();
}

export interface WatermarkOptions {
  text: string;
  fontSize: number;
  /** 0 to 1. */
  opacity: number;
  /** Corner to corner, or straight across. */
  angle: "diagonal" | "horizontal";
  /** 0-based pages to stamp; every page when omitted. */
  pages?: readonly number[];
}

export async function addWatermark(
  bytes: Uint8Array,
  options: WatermarkOptions,
): Promise<Uint8Array> {
  const text = options.text.trim();
  if (!text) throw new PdfError("unsupported-text");
  const doc = await load(bytes);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  checkEncodable(font, text);

  const only = options.pages ? new Set(options.pages) : null;
  doc.getPages().forEach((page, index) => {
    if (only && !only.has(index)) return;
    const frame = visualFrame(page);
    const angle =
      options.angle === "diagonal" ? (Math.atan2(frame.height, frame.width) * 180) / Math.PI : 0;
    // Never wider than the page's diagonal (or width), however large the size asked for.
    const span = options.angle === "diagonal" ? Math.hypot(frame.width, frame.height) : frame.width;
    const size = Math.min(
      options.fontSize,
      (options.fontSize * span * 0.85) / font.widthOfTextAtSize(text, options.fontSize),
    );
    const width = font.widthOfTextAtSize(text, size);
    const capHeight = font.heightAtSize(size, { descender: false });

    // Centre the text's box on the page's centre, along the angle.
    const radians = (angle * Math.PI) / 180;
    const start = {
      x: frame.width / 2 - (width / 2) * Math.cos(radians) + (capHeight / 2) * Math.sin(radians),
      y: frame.height / 2 - (width / 2) * Math.sin(radians) - (capHeight / 2) * Math.cos(radians),
    };
    drawVisualText(page, text, { start, angle, font, size, opacity: options.opacity, grey: 0.5 });
  });
  return doc.save();
}
