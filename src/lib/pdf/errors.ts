/**
 * What can go wrong with a PDF, in its own module so the page can name the
 * problem without importing pdf-lib, which lives only in the worker.
 */

export type PdfErrorReason = "encrypted" | "invalid" | "unsupported-text" | "no-pages";

export const PDF_ERROR_REASONS: readonly PdfErrorReason[] = [
  "encrypted",
  "invalid",
  "unsupported-text",
  "no-pages",
];

export class PdfError extends Error {
  constructor(readonly reason: PdfErrorReason) {
    super(reason);
    this.name = "PdfError";
  }
}
