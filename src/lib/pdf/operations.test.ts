// @vitest-environment node
import { createRequire } from "node:module";
import { dirname } from "node:path";

import { PDFDocument, StandardFonts, degrees } from "pdf-lib";
// The legacy build, as the app uses: the modern one needs Promise.try, which
// Node 22 and pre-2025 browsers lack.
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";

import {
  PdfError,
  addPageNumbers,
  addWatermark,
  compressLossless,
  imagesToPdf,
  mergePdfs,
  organizePages,
  pdfFromRasters,
  pdfInfo,
  selectPages,
  splitPdf,
  toPageSpace,
} from "./operations";

const require = createRequire(import.meta.url);
const STANDARD_FONTS = `${dirname(require.resolve("pdfjs-dist/package.json"))}/standard_fonts/`;

beforeAll(() => {
  pdfjs.GlobalWorkerOptions.workerSrc = require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");
});

/** A PDF whose pages each say which page they are, so order can be checked. */
async function makePdf(labels: string[], options: { rotate?: number[] } = {}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  labels.forEach((label, index) => {
    const page = doc.addPage([400, 600]);
    page.drawText(label, { x: 50, y: 300, size: 20, font });
    const turn = options.rotate?.[index];
    if (turn) page.setRotation(degrees(turn));
  });
  return doc.save();
}

interface ReadPage {
  text: string;
  rotation: number;
  /** Visible size, rotation applied. */
  width: number;
  height: number;
  /** Where each text item starts as seen, origin top-left. */
  items: { text: string; x: number; y: number }[];
}

/** Reads a PDF back the way a viewer would, with pdf.js. */
async function read(bytes: Uint8Array): Promise<ReadPage[]> {
  const task = pdfjs.getDocument({ data: bytes.slice(), standardFontDataUrl: STANDARD_FONTS });
  const doc = await task.promise;
  const pages: ReadPage[] = [];
  for (let number = 1; number <= doc.numPages; number += 1) {
    const page = await doc.getPage(number);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items = content.items.flatMap((item) => {
      if (!("str" in item) || !item.str.trim()) return [];
      const [x, y] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
      return [{ text: item.str, x, y }];
    });
    pages.push({
      text: items.map((item) => item.text).join(" "),
      rotation: page.rotate,
      width: viewport.width,
      height: viewport.height,
      items,
    });
  }
  await task.destroy();
  return pages;
}

async function texts(bytes: Uint8Array): Promise<string[]> {
  return (await read(bytes)).map((page) => page.text);
}

describe("reading", () => {
  it("counts pages", async () => {
    expect(await pdfInfo(await makePdf(["a", "b", "c"]))).toEqual({ pageCount: 3 });
  });

  it("names the problem with a file that is not a PDF", async () => {
    await expect(pdfInfo(new TextEncoder().encode("hello"))).rejects.toEqual(
      new PdfError("invalid"),
    );
  });
});

describe("page operations", () => {
  it("merges in the order given", async () => {
    const merged = await mergePdfs([await makePdf(["A1", "A2"]), await makePdf(["B1"])]);
    expect(await texts(merged)).toEqual(["A1", "A2", "B1"]);
  });

  it("selects pages in the order asked, repeats included", async () => {
    const source = await makePdf(["p1", "p2", "p3"]);
    expect(await texts(await selectPages(source, [2, 0, 0]))).toEqual(["p3", "p1", "p1"]);
    await expect(selectPages(source, [])).rejects.toEqual(new PdfError("no-pages"));
  });

  it("splits into several files", async () => {
    const parts = await splitPdf(await makePdf(["p1", "p2", "p3"]), [[0, 1], [2]]);
    expect(await Promise.all(parts.map(texts))).toEqual([["p1", "p2"], ["p3"]]);
  });

  it("reorders, rotates on top of existing rotation, and drops pages", async () => {
    const source = await makePdf(["p1", "p2", "p3"], { rotate: [0, 90, 0] });
    const output = await read(
      await organizePages(source, [
        { index: 1, rotation: 90 },
        { index: 0, rotation: 270 },
      ]),
    );
    expect(output.map((page) => [page.text, page.rotation])).toEqual([
      ["p2", 180],
      ["p1", 270],
    ]);
  });

  it("saves losslessly without changing content", async () => {
    const source = await makePdf(["kept"]);
    expect(await texts(await compressLossless(source))).toEqual(["kept"]);
  });
});

describe("images", () => {
  async function jpeg(width: number, height: number) {
    const bytes = await sharp({
      create: { width, height, channels: 3, background: { r: 200, g: 50, b: 50 } },
    })
      .jpeg()
      .toBuffer();
    return { bytes: new Uint8Array(bytes), format: "jpeg" as const, width, height };
  }

  it("makes one page per image, shaped like the image when fitting", async () => {
    const pages = await read(
      await imagesToPdf([await jpeg(400, 300), await jpeg(300, 600)], {
        pageSize: "fit",
        margin: 0,
      }),
    );
    expect(pages.map((page) => [Math.round(page.width), Math.round(page.height)])).toEqual([
      [842, 631],
      [421, 842],
    ]);
  });

  it("turns A4 paper to match a landscape image", async () => {
    const [page] = await read(
      await imagesToPdf([await jpeg(400, 300)], { pageSize: "a4", margin: 36 }),
    );
    expect([Math.round(page?.width ?? 0), Math.round(page?.height ?? 0)]).toEqual([842, 595]);
  });

  it("rebuilds pages from images at their original sizes", async () => {
    const image = await jpeg(100, 100);
    const pages = await read(
      await pdfFromRasters([{ jpeg: image.bytes, width: 200, height: 300 }]),
    );
    expect([pages[0]?.width, pages[0]?.height]).toEqual([200, 300]);
  });
});

describe("stamping text", () => {
  it("maps what the reader sees onto a rotated page's own coordinates", () => {
    const box = { x: 0, y: 0, width: 400, height: 600 };
    expect(toPageSpace({ x: 10, y: 20 }, box, 0)).toEqual({ x: 10, y: 20 });
    expect(toPageSpace({ x: 10, y: 20 }, box, 90)).toEqual({ x: 380, y: 10 });
    expect(toPageSpace({ x: 10, y: 20 }, box, 180)).toEqual({ x: 390, y: 580 });
    expect(toPageSpace({ x: 10, y: 20 }, box, 270)).toEqual({ x: 20, y: 590 });
    expect(toPageSpace({ x: 0, y: 0 }, { ...box, x: 5, y: 7 }, 0)).toEqual({ x: 5, y: 7 });
  });

  it("numbers pages at the bottom centre as seen, even on a sideways page", async () => {
    const source = await makePdf(["cover", "one", "two"], { rotate: [0, 0, 90] });
    const pages = await read(
      await addPageNumbers(source, {
        position: "bottom-center",
        template: "Page {n} of {total}",
        startAt: 1,
        skipFirst: true,
        fontSize: 10,
      }),
    );
    expect(pages[0]?.text).toBe("cover");
    for (const [index, label] of [
      [1, "Page 1 of 2"],
      [2, "Page 2 of 2"],
    ] as const) {
      const page = pages[index];
      const item = page?.items.find((entry) => entry.text === label);
      expect(item, label).toBeDefined();
      if (!page || !item) continue;
      // Near the bottom edge, roughly centred, in the visible orientation.
      expect(item.y).toBeGreaterThan(page.height - 40);
      expect(Math.abs(item.x - page.width / 2)).toBeLessThan(40);
    }
  });

  it("refuses text the standard fonts cannot draw rather than garbling it", async () => {
    const source = await makePdf(["x"]);
    await expect(
      addWatermark(source, { text: "مسودہ", fontSize: 60, opacity: 0.2, angle: "diagonal" }),
    ).rejects.toEqual(new PdfError("unsupported-text"));
  });

  it("watermarks only the pages asked for, within the page", async () => {
    const source = await makePdf(["one", "two"]);
    const pages = await read(
      await addWatermark(source, {
        text: "DRAFT",
        fontSize: 400,
        opacity: 0.2,
        angle: "diagonal",
        pages: [1],
      }),
    );
    expect(pages[0]?.text).toBe("one");
    const mark = pages[1]?.items.find((item) => item.text === "DRAFT");
    expect(mark).toBeDefined();
    // Oversized text is scaled down, so it starts on the page.
    expect(mark?.x).toBeGreaterThanOrEqual(0);
    expect(mark?.y).toBeLessThanOrEqual(600);
  });
});
