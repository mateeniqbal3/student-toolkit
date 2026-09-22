/**
 * The PDF operations, each with its own indexable route under /pdf-tools.
 *
 * "Merge PDF" and "compress PDF" are among the things students search for
 * most, so each operation gets a page Google can land on rather than a tab
 * inside one page. Like the tool registry, this is data only, and the copy
 * lives here rather than in components, ready for translation.
 */

export const PDF_OPERATION_SLUGS = [
  "merge",
  "split",
  "organize",
  "compress",
  "images-to-pdf",
  "pdf-to-images",
  "extract-text",
  "page-numbers",
  "watermark",
] as const;

export type PdfOperationSlug = (typeof PDF_OPERATION_SLUGS)[number];

export interface PdfOperation {
  slug: PdfOperationSlug;
  name: string;
  /** One line, for the hub's cards and the page's subtitle. */
  tagline: string;
  /** For the page's metadata description. */
  description: string;
  keywords: string[];
}

export const PDF_OPERATIONS: readonly PdfOperation[] = [
  {
    slug: "merge",
    name: "Merge PDF",
    tagline: "Combine several PDFs into one, in the order you choose",
    description:
      "Merge PDF files into a single document in your browser. Put them in any order, then download one PDF. Nothing is uploaded, so it works offline and on private documents.",
    keywords: ["merge pdf", "combine pdf", "join pdf"],
  },
  {
    slug: "split",
    name: "Split PDF",
    tagline: "Pull out pages, or cut a PDF into several files",
    description:
      "Split a PDF by page ranges, into every N pages, or extract just the pages you need. It all happens in your browser; the file is never uploaded.",
    keywords: ["split pdf", "extract pdf pages", "separate pdf"],
  },
  {
    slug: "organize",
    name: "Organize PDF pages",
    tagline: "Reorder, rotate and delete pages",
    description:
      "See every page of a PDF, then move pages around, rotate sideways scans and delete the pages you do not need. Processed in your browser, never uploaded.",
    keywords: ["reorder pdf pages", "rotate pdf", "delete pdf pages", "organize pdf"],
  },
  {
    slug: "compress",
    name: "Compress PDF",
    tagline: "Make a PDF small enough to upload or email",
    description:
      "Shrink a PDF to fit a portal's upload limit or an email attachment. Choose a lossless clean-up or stronger compression for scans. Your file never leaves your device.",
    keywords: ["compress pdf", "reduce pdf size", "shrink pdf"],
  },
  {
    slug: "images-to-pdf",
    name: "Images to PDF",
    tagline: "Turn photos of pages into one PDF",
    description:
      "Convert JPG, PNG and other images into a single PDF, one image per page, sized to fit or to A4 or Letter. Ideal for handing in photos of handwritten work.",
    keywords: ["jpg to pdf", "image to pdf", "photos to pdf", "png to pdf"],
  },
  {
    slug: "pdf-to-images",
    name: "PDF to images",
    tagline: "Save pages as PNG or JPG",
    description:
      "Turn the pages of a PDF into PNG or JPG images at the resolution you need, for slides, notes or sharing. Converted in your browser.",
    keywords: ["pdf to jpg", "pdf to png", "pdf to image"],
  },
  {
    slug: "extract-text",
    name: "Extract text from PDF",
    tagline: "Copy the text out of a PDF",
    description:
      "Pull all the text out of a PDF, page by page, to copy into your notes or save as a text file. Works on PDFs that contain text; scans need OCR.",
    keywords: ["pdf to text", "extract text from pdf", "copy text from pdf"],
  },
  {
    slug: "page-numbers",
    name: "Add page numbers",
    tagline: "Number the pages of a PDF",
    description:
      "Add page numbers to a PDF in the corner or centre you choose, as 1, Page 1 or Page 1 of 10, optionally skipping a cover page. Done in your browser.",
    keywords: ["add page numbers to pdf", "number pdf pages"],
  },
  {
    slug: "watermark",
    name: "Watermark PDF",
    tagline: "Stamp text such as DRAFT across every page",
    description:
      "Add a text watermark such as DRAFT or your name across the pages of a PDF, with the size, angle and transparency you choose. Nothing is uploaded.",
    keywords: ["watermark pdf", "stamp pdf", "add text to pdf"],
  },
];

export function getPdfOperation(slug: string): PdfOperation | undefined {
  return PDF_OPERATIONS.find((operation) => operation.slug === slug);
}
