/**
 * Markdown to HTML for the note preview, with KaTeX maths.
 *
 * This module is heavy (markdown-it and KaTeX together) and is only ever
 * reached through a dynamic import, so the notes list and editor load
 * without it.
 *
 * The output is safe to insert as HTML because of how it is configured, not
 * because it is cleaned afterwards:
 *
 * - `html: false` escapes any raw HTML a note contains, so `<script>` shows
 *   as text.
 * - markdown-it refuses `javascript:`, `vbscript:` and most `data:` link
 *   targets.
 * - KaTeX runs with `trust` off, so `\href` and `\includegraphics` cannot
 *   produce links or load anything.
 * - Images are switched off. A remote image would make the browser fetch it
 *   whenever the note is opened, telling that server when and from where;
 *   `![alt](url)` renders as a link instead, which is only followed if
 *   clicked.
 */
import markdownItKatex from "@vscode/markdown-it-katex";
import markdownIt, { type MarkdownIt } from "markdown-it";

let renderer: MarkdownIt | null = null;

function createRenderer(): MarkdownIt {
  const md = markdownIt({ html: false, linkify: true, typographer: true, breaks: false });
  md.use(markdownItKatex, { throwOnError: false, enableFencedBlocks: true });
  md.disable("image");

  // Links leave the app in a new tab, without telling the destination where from.
  const defaultLinkOpen =
    md.renderer.rules.link_open ??
    ((tokens, index, options, _env, self) => self.renderToken(tokens, index, options));
  md.renderer.rules.link_open = (tokens, index, options, env, self) => {
    const token = tokens[index];
    if (token) {
      token.attrSet("target", "_blank");
      token.attrSet("rel", "noopener noreferrer nofollow");
    }
    return defaultLinkOpen(tokens, index, options, env, self);
  };

  return md;
}

export function renderMarkdown(markdown: string): string {
  renderer ??= createRenderer();
  return renderer.render(markdown);
}
