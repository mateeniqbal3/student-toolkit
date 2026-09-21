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
