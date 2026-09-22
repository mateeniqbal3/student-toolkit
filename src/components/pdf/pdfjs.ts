/**
 * pdf.js, for everything that has to see inside a PDF: page thumbnails,
 * pages as images, and text. Loaded on first use, never with the page.
 */
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist/legacy/build/pdf.mjs";

import { PdfError } from "@/lib/pdf/errors";

type PdfJs = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

let loading: Promise<PdfJs> | null = null;

export function loadPdfJs(): Promise<PdfJs> {
  loading ??= import("pdfjs-dist/legacy/build/pdf.mjs").then((lib) => {
    lib.GlobalWorkerOptions.workerPort = new Worker(
      new URL("../../workers/pdfjs.worker.ts", import.meta.url),
      { type: "module" },
    );
    return lib;
  });
  return loading;
}

export interface OpenDocument {
  doc: PDFDocumentProxy;
  close: () => Promise<void>;
}

/** Opens a PDF for reading. The bytes are copied: pdf.js takes ownership of what it is given. */
export async function openDocument(bytes: Uint8Array): Promise<OpenDocument> {
  const lib = await loadPdfJs();
  const task = lib.getDocument({ data: bytes.slice() });
  try {
    const doc = await task.promise;
    return { doc, close: () => task.destroy() };
  } catch (error) {
    await task.destroy();
    throw new PdfError(error instanceof lib.PasswordException ? "encrypted" : "invalid");
  }
}

/**
 * Canvases beyond about 16 million pixels fail outright on many phones, so
 * a page is never drawn with a longer side than this, whatever DPI is asked.
 */
const MAX_SIDE = 4096;

/** The scale for drawing a page at `dpi`, capped so the canvas stays drawable. */
export function scaleForDpi(page: PDFPageProxy, dpi: number): number {
  const { width, height } = page.getViewport({ scale: 1 });
  return Math.min(dpi / 72, MAX_SIDE / Math.max(width, height));
}

/** Draws a page at `scale` (1 = 72 DPI) onto a new canvas, on white as on paper. */
export async function renderPage(page: PDFPageProxy, scale: number): Promise<HTMLCanvasElement> {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  await page.render({ canvas, viewport, background: "#ffffff" }).promise;
  return canvas;
}

export function canvasToBytes(
  canvas: HTMLCanvasElement,
  type: "image/png" | "image/jpeg",
  quality?: number,
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("encode-failed"));
          return;
        }
        void blob.arrayBuffer().then((buffer) => resolve(new Uint8Array(buffer)));
      },
      type,
      quality,
    );
  });
}

/** Frees a canvas's memory at once, rather than whenever the collector gets to it. */
export function releaseCanvas(canvas: HTMLCanvasElement): void {
  canvas.width = 0;
  canvas.height = 0;
}

/** Each page's text, in reading order as pdf.js gives it, with line breaks kept. */
export async function extractText(
  doc: PDFDocumentProxy,
  onPage?: (done: number, total: number) => void,
): Promise<string[]> {
  const pages: string[] = [];
  for (let number = 1; number <= doc.numPages; number += 1) {
    const page = await doc.getPage(number);
    const content = await page.getTextContent();
    let text = "";
    for (const item of content.items) {
      if (!("str" in item)) continue;
      text += item.str;
      if (item.hasEOL) text += "\n";
    }
    pages.push(text.replace(/[ \t]+\n/g, "\n").trim());
    page.cleanup();
    onPage?.(number, doc.numPages);
  }
  return pages;
}
