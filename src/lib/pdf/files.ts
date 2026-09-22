/**
 * Small helpers for naming and describing files.
 */

/** "1.4 MB". Decimal units, as file managers and upload limits state them. */
export function formatBytes(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes;
  let unit = -1;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit += 1;
  }
  return `${value >= 100 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

/** "Lecture 4.PDF" becomes "Lecture 4". */
export function baseName(filename: string): string {
  return filename.replace(/\.[^./\\]+$/, "") || filename;
}

/** How much smaller, as a whole percentage; negative when it grew. */
export function savedPercent(before: number, after: number): number {
  if (before <= 0) return 0;
  return Math.round((1 - after / before) * 100);
}

/** True for files that look like PDFs by their first bytes, whatever they are called. */
export function looksLikePdf(bytes: Uint8Array): boolean {
  // "%PDF-" may follow a little junk; readers accept it within the first kilobyte.
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 1024));
  return head.includes("%PDF-");
}
