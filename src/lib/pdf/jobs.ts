/**
 * The messages the page sends to the PDF worker, and the one function that
 * carries them out. Kept apart from the worker so the page can run the same
 * code on its own thread where workers are unavailable.
 */
import {
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
  type EmbeddableImage,
  type ImageLayout,
  type PageNumberOptions,
  type PagePlan,
  type PdfInfo,
  type RasterPage,
  type WatermarkOptions,
} from "./operations";

export type PdfJob =
  | { op: "info"; bytes: Uint8Array }
  | { op: "merge"; files: Uint8Array[] }
  | { op: "select"; bytes: Uint8Array; indexes: number[] }
  | { op: "split"; bytes: Uint8Array; groups: number[][] }
  | { op: "organize"; bytes: Uint8Array; plan: PagePlan[] }
  | { op: "images"; images: EmbeddableImage[]; layout: ImageLayout }
  | { op: "rasters"; pages: RasterPage[] }
  | { op: "compress"; bytes: Uint8Array }
  | { op: "pageNumbers"; bytes: Uint8Array; options: PageNumberOptions }
  | { op: "watermark"; bytes: Uint8Array; options: WatermarkOptions };

interface ResultByOp {
  info: PdfInfo;
  merge: Uint8Array;
  select: Uint8Array;
  split: Uint8Array[];
  organize: Uint8Array;
  images: Uint8Array;
  rasters: Uint8Array;
  compress: Uint8Array;
  pageNumbers: Uint8Array;
  watermark: Uint8Array;
}

export type JobResult<J extends PdfJob> = ResultByOp[J["op"]];

export type AnyJobResult = ResultByOp[keyof ResultByOp];

export function runJob(job: PdfJob): Promise<AnyJobResult> {
  switch (job.op) {
    case "info":
      return pdfInfo(job.bytes);
    case "merge":
      return mergePdfs(job.files);
    case "select":
      return selectPages(job.bytes, job.indexes);
    case "split":
      return splitPdf(job.bytes, job.groups);
    case "organize":
      return organizePages(job.bytes, job.plan);
    case "images":
      return imagesToPdf(job.images, job.layout);
    case "rasters":
      return pdfFromRasters(job.pages);
    case "compress":
      return compressLossless(job.bytes);
    case "pageNumbers":
      return addPageNumbers(job.bytes, job.options);
    case "watermark":
      return addWatermark(job.bytes, job.options);
  }
}

/** The byte buffers in a result, handed back to the page without copying. */
export function resultBuffers(result: AnyJobResult): ArrayBuffer[] {
  const arrays = result instanceof Uint8Array ? [result] : Array.isArray(result) ? result : [];
  return arrays.flatMap((array) => (array.buffer instanceof ArrayBuffer ? [array.buffer] : []));
}
