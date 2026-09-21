/**
 * Saving generated files. Nothing is uploaded: every file is built in memory
 * and handed to the browser's own download.
 */

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Revoked on the next task, after the browser has started the download.
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function downloadFile(filename: string, content: string, type: string): void {
  downloadBlob(filename, new Blob([content], { type }));
}

/** "Thesis — Chapter 2" becomes "thesis-chapter-2". */
export function fileSlug(name: string, fallback = "download"): string {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "") || fallback
  );
}
