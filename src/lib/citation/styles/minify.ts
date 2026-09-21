/**
 * Shrinks a CSL style for shipping to the browser.
 *
 * CSL keeps every piece of printed text in attributes, so whitespace between
 * tags and XML comments carry no meaning and can go. The `<info>` block stays:
 * it holds the style's licence and attribution, which CC BY-SA requires us to
 * keep with the file.
 *
 * Shared by `scripts/generate-csl-styles.mjs`, which writes the modules the
 * app imports, and by the test that checks those modules are up to date. It
 * is plain enough for Node to run with its built-in type stripping.
 */
export function minifyCsl(xml: string): string {
  return xml
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/>\s+</g, "><")
    .trim();
}

/** Which source file each generated style module is built from. */
export const CSL_SOURCES = {
  apa: "apa.csl",
  mla: "modern-language-association.csl",
  chicago: "chicago-author-date.csl",
  ieee: "ieee.csl",
  harvard: "harvard-cite-them-right.csl",
} as const;
