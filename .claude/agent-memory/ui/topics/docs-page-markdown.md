# Dev-only `/docs` page + hand-rolled markdown renderer

- `app/lib/markdown.ts` (`renderMarkdown` for block content, plus a
  smaller exported `renderMarkdownInline` wrapper for a single already-
  flattened line) is a hand-rolled markdown renderer — NOT a dependency;
  there is no marked/markdown-it/@nuxt/content anywhere in this project.
  Adding a markdown library is `server`'s call, not `ui`'s — don't reach
  for one without checking with them first. Scope is deliberately limited
  to what the real docs actually use: ATX headers, fenced code blocks
  (highlighted via the already-present `highlight.js/lib/core`, same
  hand-mapped `.hljs-*` palette `FunctionalModelScript.vue`/
  `JsonHighlight.vue` already use), flat + one-level-nested lists
  (including wrapped continuation lines), blockquotes, hr, paragraphs,
  inline bold/italic/code/link, and (added later) `~~strikethrough~~`.
  No tables/images/setext headings — none exist in any real consumed doc.
- `renderInline()` must be called ONCE over each list item's fully
  accumulated raw text at flush time, not separately per source line —
  calling it per-line breaks any inline span (bold/code/link) that wraps
  across two source lines, which is common in this repo's hand-wrapped
  prose (e.g. ENGINE_GAPS.md).
- This same `renderInline`/`renderMarkdownInline` is also what the
  Features tab (`/app/engine/features`) uses to render `evidence.excerpt`
  (a raw quoted fragment of ENGINE_GAPS.md's own markdown, containing real
  `~~`/`**` markers) — fixing this helper fixes both consumers at once,
  they're not independent.
- The `/docs` page itself and its two `server/api/docs/*` routes are
  dev-only via `import.meta.dev` (client) + `process.env.NODE_ENV ===
  'production'` (server, both routes independently) — confirmed via an
  actual production build that both routes AND the page's whole `setup()`
  body get dead-code-eliminated by Rollup, not just runtime-gated.
