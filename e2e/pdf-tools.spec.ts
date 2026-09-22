import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";

import { expect, test, type Download, type Page } from "@playwright/test";
import { unzipSync } from "fflate";
import { PDFDocument, StandardFonts } from "pdf-lib";
import sharp from "sharp";

/**
 * A PDF whose pages have distinct widths (100, 110, 120… points, unless
 * given), so the order of pages in a result can be read back without
 * extracting text.
 */
async function makePdf(pageCount: number, options: { widths?: number[]; text?: string } = {}) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let index = 0; index < pageCount; index += 1) {
    const width = options.widths?.[index] ?? 100 + index * 10;
    const page = doc.addPage([width, 200]);
    if (options.text) page.drawText(options.text, { x: 5, y: 100, size: 8, font });
  }
  return Buffer.from(await doc.save());
}

function pdfFile(name: string, buffer: Buffer) {
  return { name, mimeType: "application/pdf", buffer };
}

/** Random pixels: a PNG that barely compresses, standing in for a heavy scan. */
async function noisePng(size: number): Promise<Buffer> {
  const pixels = randomBytes(size * size * 3);
  return sharp(pixels, { raw: { width: size, height: size, channels: 3 } })
    .png()
    .toBuffer();
}

async function saved(download: Download): Promise<Buffer> {
  return readFile(await download.path());
}

async function widths(buffer: Buffer): Promise<number[]> {
  const doc = await PDFDocument.load(buffer);
  return doc.getPages().map((page) => Math.round(page.getWidth()));
}

async function downloadFrom(page: Page, button: RegExp | string): Promise<Download> {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("region", { name: "Result" }).getByRole("button", { name: button }).click(),
  ]);
  return download;
}

async function choosePdf(page: Page, name: string, buffer: Buffer) {
  await page.locator('input[type="file"]').setInputFiles(pdfFile(name, buffer));
  await expect(page.getByRole("button", { name: "Choose a different PDF" })).toBeVisible();
}

test.describe("PDF tools", () => {
  test("lists every operation, each on its own titled page", async ({ page }) => {
    await page.goto("/pdf-tools");
    const links = page.getByRole("main").getByRole("link", { name: /PDF|Images|text|numbers/ });
    await expect(links).toHaveCount(9);
    await page.getByRole("link", { name: /Merge PDF/ }).click();
    await expect(page).toHaveURL(/\/pdf-tools\/merge$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Merge PDF");
    await expect(page).toHaveTitle(/Merge PDF/);
    await page.getByRole("link", { name: "All PDF tools" }).click();
    await expect(page).toHaveURL(/\/pdf-tools$/);
  });

  test("merges PDFs in the order chosen", async ({ page }) => {
    await page.goto("/pdf-tools/merge");
    await page
      .locator('input[type="file"]')
      .setInputFiles([
        pdfFile("first.pdf", await makePdf(2, { widths: [300, 310] })),
        pdfFile("second.pdf", await makePdf(1, { widths: [500] })),
      ]);
    await page.getByRole("button", { name: "Move second.pdf up" }).click();
    await page.getByRole("button", { name: "Merge 2 PDFs (3 pages)" }).click();

    const download = await downloadFrom(page, /Download merged\.pdf/);
    expect(download.suggestedFilename()).toBe("merged.pdf");
    expect(await widths(await saved(download))).toEqual([500, 300, 310]);
  });

  test("turns away a file that is not a PDF, naming the problem", async ({ page }) => {
    await page.goto("/pdf-tools/merge");
    await page
      .locator('input[type="file"]')
      .setInputFiles({ name: "essay.pdf", mimeType: "application/pdf", buffer: Buffer.from("hi") });
    await expect(
      page.getByRole("alert").filter({ hasText: "could not be read as a PDF" }),
    ).toBeVisible();
  });

  test("extracts chosen pages, and explains a bad range", async ({ page }) => {
    await page.goto("/pdf-tools/split");
    await choosePdf(page, "lecture.pdf", await makePdf(5));

    await page.getByLabel("Pages to keep").fill("2-3, 9");
    await expect(page.getByText("“9” is outside this PDF, which has 5 pages.")).toBeVisible();
    await page.getByLabel("Pages to keep").fill("5, 2-3");

    await page.getByRole("button", { name: "Make a PDF of 3 pages" }).click();
    const download = await downloadFrom(page, /Download lecture-pages/);
    expect(await widths(await saved(download))).toEqual([140, 110, 120]);
  });

  test("splits every N pages into a zip", async ({ page }) => {
    await page.goto("/pdf-tools/split");
    await choosePdf(page, "notes.pdf", await makePdf(5));
    await page.getByRole("button", { name: "Every N pages" }).click();
    await page.getByLabel("Pages per file").fill("2");
    await page.getByRole("button", { name: "Split into 3 files" }).click();

    const download = await downloadFrom(page, "Download all as .zip");
    const entries = unzipSync(new Uint8Array(await saved(download)));
    expect(Object.keys(entries).sort()).toEqual([
      "notes-pages-1-2.pdf",
      "notes-pages-3-4.pdf",
      "notes-pages-5.pdf",
    ]);
  });

  test("reorders, rotates and deletes pages, with thumbnails", async ({ page }) => {
    await page.goto("/pdf-tools/organize");
    await choosePdf(page, "scan.pdf", await makePdf(3));
    await expect(page.getByRole("img", { name: "Page 3" })).toBeVisible();

    await page.getByRole("button", { name: "Delete page 2" }).click();
    await page.getByRole("button", { name: "Move page 3 earlier" }).click();
    await page.getByRole("button", { name: "Rotate page 1 right" }).click();
    await page.getByRole("button", { name: "Save the new PDF" }).click();

    const buffer = await saved(await downloadFrom(page, /Download scan-organized\.pdf/));
    const doc = await PDFDocument.load(buffer);
    expect(
      doc.getPages().map((entry) => [Math.round(entry.getWidth()), entry.getRotation().angle]),
    ).toEqual([
      [120, 0],
      [100, 90],
    ]);
  });

  test("compresses a scan by redrawing its pages", async ({ page }) => {
    const doc = await PDFDocument.create();
    const image = await doc.embedPng(await noisePng(1200));
    doc.addPage([595, 842]).drawImage(image, { x: 0, y: 0, width: 595, height: 842 });
    const scan = Buffer.from(await doc.save());

    await page.goto("/pdf-tools/compress");
    // Compressing uses both workers (pdf.js to draw the pages, pdf-lib to
    // rebuild the PDF). Once the service worker is serving the page, both are
    // fetched from its cache, which is where the two used to get each other's
    // code and hang. Waiting for it and reloading pins that down.
    await page.evaluate(() => navigator.serviceWorker?.ready.then(() => undefined));
    await page.reload();
    await choosePdf(page, "scan.pdf", scan);
    await page.getByRole("button", { name: "Compress", exact: true }).click();

    const result = page.getByRole("region", { name: "Result" });
    await expect(result).toContainText("smaller", { timeout: 20_000 });
    const output = await saved(await downloadFrom(page, /Download scan-compressed\.pdf/));
    expect(output.length).toBeLessThan(scan.length);
    expect(await widths(output)).toEqual([595]);
  });

  test("makes a PDF from images, one per page", async ({ page }) => {
    const jpeg = (width: number, height: number) =>
      sharp({ create: { width, height, channels: 3, background: "#3366aa" } })
        .jpeg()
        .toBuffer();
    await page.goto("/pdf-tools/images-to-pdf");
    await page.locator('input[type="file"]').setInputFiles([
      { name: "page1.jpg", mimeType: "image/jpeg", buffer: await jpeg(600, 800) },
      { name: "page2.jpg", mimeType: "image/jpeg", buffer: await jpeg(800, 600) },
    ]);
    await page.getByRole("button", { name: "A4" }).click();
    await page.getByRole("button", { name: "Make a PDF of 2 images" }).click();

    const buffer = await saved(await downloadFrom(page, /Download images\.pdf/));
    const pages = (await PDFDocument.load(buffer)).getPages();
    // A4, turned to match each image.
    expect(
      pages.map((entry) => [Math.round(entry.getWidth()), Math.round(entry.getHeight())]),
    ).toEqual([
      [595, 842],
      [842, 595],
    ]);
  });

  test("saves pages as images", async ({ page }) => {
    await page.goto("/pdf-tools/pdf-to-images");
    await choosePdf(page, "slides.pdf", await makePdf(2, { text: "slide" }));
    await page.getByRole("button", { name: "Convert 2 pages" }).click();

    const download = await downloadFrom(page, "Download all as .zip");
    const entries = unzipSync(new Uint8Array(await saved(download)));
    expect(Object.keys(entries).sort()).toEqual(["slides-page-1.png", "slides-page-2.png"]);
    const meta = await sharp(Buffer.from(entries["slides-page-1.png"] ?? [])).metadata();
    // 100 points wide at 150 DPI.
    expect(meta.width).toBe(208);
  });

  test("extracts text, and says when a PDF is only pictures", async ({ page }) => {
    await page.goto("/pdf-tools/extract-text");
    await choosePdf(page, "reading.pdf", await makePdf(2, { text: "Photosynthesis in leaves" }));
    await page.getByRole("button", { name: "Extract the text" }).click();
    await expect(page.getByLabel("Text from the PDF")).toHaveValue(
      "--- Page 1 ---\nPhotosynthesis in leaves\n\n--- Page 2 ---\nPhotosynthesis in leaves",
    );

    await page.getByRole("button", { name: "Choose a different PDF" }).click();
    await choosePdf(page, "blank.pdf", await makePdf(1));
    await page.getByRole("button", { name: "Extract the text" }).click();
    await expect(page.getByText("No text was found.")).toBeVisible();
  });

  test("numbers pages, and refuses a watermark the fonts cannot draw", async ({ page }) => {
    await page.goto("/pdf-tools/page-numbers");
    await choosePdf(page, "essay.pdf", await makePdf(3));
    await page.getByRole("button", { name: "Page 1 of 10" }).click();
    await page.getByRole("button", { name: "Add page numbers" }).click();
    const numbered = await saved(await downloadFrom(page, /Download essay-numbered\.pdf/));
    expect(await widths(numbered)).toEqual([100, 110, 120]);

    await page.goto("/pdf-tools/watermark");
    await choosePdf(page, "essay.pdf", await makePdf(1));
    await page.getByLabel("Watermark text").fill("مسودہ");
    await page.getByRole("button", { name: "Add watermark" }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "characters the built-in PDF fonts" }),
    ).toBeVisible();

    await page.getByLabel("Watermark text").fill("DRAFT");
    await page.getByRole("button", { name: "Add watermark" }).click();
    await expect(page.getByRole("region", { name: "Result" })).toBeVisible();
  });

  test("organises on a 360px screen with no horizontal scroll", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto("/pdf-tools/organize");
    await choosePdf(page, "phone.pdf", await makePdf(4));
    await expect(page.getByRole("img", { name: "Page 4" })).toBeVisible();

    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflows).toBe(false);
  });
});
