/**
 * The preview's heavy half: markdown-it, KaTeX and KaTeX's stylesheet and
 * fonts. Only ever loaded with `import()`, so none of it is in the notes
 * page's initial download.
 */
import "katex/dist/katex.min.css";

export { renderMarkdown } from "@/lib/notes/markdown";
