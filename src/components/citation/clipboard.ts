/**
 * Browser plumbing for getting citations out of the page.
 */

/**
 * Copies with formatting where the browser allows it, so italics and the
 * hanging indent survive a paste into Word or Google Docs, and as plain text
 * everywhere else. Resolves to whether anything was copied.
 */
export async function copyToClipboard(text: string, html?: string): Promise<boolean> {
  try {
    if (html && typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([text], { type: "text/plain" }),
        }),
      ]);
      return true;
    }
  } catch {
    // Firefox before 127 and some embedded browsers refuse rich writes; plain
    // text below still gets the citation out.
  }

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Saves a string as a file. Nothing is uploaded: the file is built in memory. */
export function downloadFile(filename: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Revoked on the next task, after the browser has started the download.
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** "Thesis — Chapter 2" becomes "thesis-chapter-2". */
export function fileSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "") || "bibliography"
  );
}
