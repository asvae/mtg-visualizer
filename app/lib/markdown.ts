// Hand-rolled, deliberately non-CommonMark-complete Markdown -> HTML
// renderer for the dev-only `/docs` page (app/pages/docs/[[slug]].vue). No
// markdown-rendering dependency exists in package.json (marked/markdown-it/
// @nuxt/content) and adding one is `server` agent's call, not this file's —
// this covers exactly what this repo's own docs actually use (checked by
// grepping README.md/NEXT_STEPS.md/WISHLIST.md/SET_STATUS.md/docs/prds/*.md/
// functional-model/*.md before writing this): ATX headers, fenced code
// blocks (plain/`ts`/`json`/`jsonc`), flat + one-level-nested bulleted/
// numbered lists (including wrapped continuation text under an item, which
// is how e.g. ENGINE_GAPS.md's own numbered list items are actually
// formatted), blockquotes, horizontal rules, paragraphs, and inline
// bold/italic/code/links. Not a general-purpose parser — no tables, no
// setext headings, no images (none of the real docs use them, confirmed by
// the same grep).
//
// Code-fence highlighting reuses the exact pattern already established by
// FunctionalModelScript.vue/JsonHighlight.vue: `highlight.js/lib/core` (not
// the full bundle) + only the two languages actually appearing in a fence
// tag across these docs (`ts` and `jsonc`), so the page importing this file
// doesn't pull in every language highlight.js knows. The matching
// `.hljs-*` color mapping lives in app/pages/docs/[[slug]].vue's own
// `:global(...)` style block (same reason those two components keep it
// local rather than a shared stylesheet: each caller's own palette mapping
// is a one-off, not something worth centralizing).
import hljs from 'highlight.js/lib/core';
import typescript from 'highlight.js/lib/languages/typescript';
import json from 'highlight.js/lib/languages/json';

hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('json', json);

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Inline formatting — applied to text already known not to be a fenced code
// block. Order matters: inline `code` spans are pulled out (and their
// content escaped-but-otherwise-untouched) before bold/italic/link
// substitution runs, so e.g. an underscore inside a `code` span never gets
// mistaken for an `_italic_` marker.
function renderInline(text: string): string {
  let out = escapeHtml(text);
  // `@@<index>@@` placeholders — none of these docs' prose uses that
  // sequence, so a stashed inline-code span can't collide with real text
  // (unlike e.g. a plain space-padded numeric index, which a real number
  // already in the prose — "3" in "the file has 3 sections" — could).
  const codeSpans: string[] = [];
  out = out.replace(/`([^`]+)`/g, (_m, code: string) => {
    codeSpans.push(code);
    return `@@${codeSpans.length - 1}@@`;
  });
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  // GFM strikethrough (`~~text~~`) — ENGINE_GAPS.md's own numbered gap list
  // uses this a lot to mark a superseded claim before its "CLOSED" rewrite
  // (e.g. "~~A narrow real slice~~ ~~CLOSED for single-color...~~ CLOSED for
  // real (2026-09-14)"). Added alongside bold/italic below rather than as a
  // separate helper — same escaped-text-only substitution pass, no new
  // safety surface.
  out = out.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  out = out.replace(/(^|[^\w])_([^_]+)_(?!\w)/g, '$1<em>$2</em>');
  out = out.replace(/@@(\d+)@@/g, (_m, i: string) => `<code>${codeSpans[Number(i)]}</code>`);
  return out;
}

function indentOf(line: string): number {
  const m = line.match(/^ */);
  return m ? m[0].length : 0;
}

const LIST_MARKER = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;

interface ListItem {
  /** Raw (unrendered) text accumulated from the marker line plus every
   * wrapped continuation line under it — inline formatting is applied ONCE
   * over the fully-joined text at flush time, not per source line; an
   * earlier per-line version broke on any `**bold**`/`` `code` `` span that
   * happened to wrap across two lines (a real, common shape in these docs —
   * e.g. ENGINE_GAPS.md's "**Stun and finality counters — ... their one
   * real chokepoint.**" opens on one line and closes on the next), since
   * `renderInline` never saw the opening and closing marker in the same
   * call. Caught by manually diffing rendered output against source during
   * this file's own verification pass, not by inspection. */
  text: string;
  /** Nested `<ul>`/`<ol>` HTML (if any), appended after the rendered text
   * when this item is flushed. */
  nested: string;
}

interface ListFrame {
  indent: number;
  ordered: boolean;
  items: ListItem[];
}

// Indent-stack list parser — a marker line deeper than the current frame's
// indent opens a nested list (folded into the parent's last item's own
// `nested` field on close); a plain (non-marker) line indented past the
// current frame's own indent is treated as more raw text belonging to that
// same item (the wrapped-continuation-line shape ENGINE_GAPS.md's numbered
// items actually use); a marker line back out at a shallower indent closes
// frames until it matches one.
function parseList(lines: string[], start: number): { html: string; next: number } {
  const stack: ListFrame[] = [];
  const finishedTop: string[] = [];
  let i = start;

  function closeFrame() {
    const f = stack.pop();
    if (!f) return;
    const tag = f.ordered ? 'ol' : 'ul';
    const itemsHtml = f.items.map((it) => `<li>${renderInline(it.text)}${it.nested}</li>`).join('');
    const html = `<${tag}>${itemsHtml}</${tag}>`;
    if (stack.length) {
      const parent = stack[stack.length - 1]!;
      const parentItem = parent.items[parent.items.length - 1]!;
      parentItem.nested += html;
    } else {
      finishedTop.push(html);
    }
  }

  while (i < lines.length) {
    const line = lines[i]!;
    if (line.trim() === '') {
      let j = i + 1;
      while (j < lines.length && lines[j]!.trim() === '') j++;
      const top = stack[stack.length - 1];
      const stillInList = j < lines.length && (LIST_MARKER.test(lines[j]!) || indentOf(lines[j]!) > (top ? top.indent : -1));
      if (!stillInList) break;
      i = j;
      continue;
    }
    const m = line.match(LIST_MARKER);
    if (m) {
      const indent = m[1]!.length;
      const ordered = /\d/.test(m[2]!);
      while (stack.length && indent < stack[stack.length - 1]!.indent) closeFrame();
      const top = stack[stack.length - 1];
      if (!top || indent > top.indent) {
        stack.push({ indent, ordered, items: [] });
      } else if (ordered !== top.ordered) {
        closeFrame();
        stack.push({ indent, ordered, items: [] });
      }
      stack[stack.length - 1]!.items.push({ text: m[3]!.trim(), nested: '' });
      i++;
      continue;
    }
    const top = stack[stack.length - 1];
    if (top && indentOf(line) > top.indent) {
      const item = top.items[top.items.length - 1]!;
      item.text += ` ${line.trim()}`;
      i++;
      continue;
    }
    break;
  }
  while (stack.length) closeFrame();
  return { html: finishedTop.join(''), next: i };
}

const HLJS_LANGUAGE: Record<string, string> = {
  ts: 'typescript',
  typescript: 'typescript',
  json: 'json',
  jsonc: 'json',
};

// Same Tailwind utility set FunctionalModelScript.vue/JsonHighlight.vue
// already put directly on their own `<pre>` (border/bg/font/size/leading/
// color) — baked into the generated markup here rather than a scoped CSS
// rule, since app/pages/docs/[[slug]].vue's own style block only needs to
// add the `.hljs-*` color mapping on top (v-html content bypasses Vue's
// scoping either way, so there's no real benefit to splitting this out).
const PRE_CLASS = 'docs-code max-h-[32rem] overflow-auto rounded border border-border bg-panel p-2 font-mono text-[11px] leading-relaxed text-text/80';

function renderCodeBlock(code: string, lang: string): string {
  const hljsLang = HLJS_LANGUAGE[lang.toLowerCase()];
  if (hljsLang) {
    try {
      const highlighted = hljs.highlight(code, { language: hljsLang }).value;
      return `<pre class="${PRE_CLASS}"><code class="hljs">${highlighted}</code></pre>`;
    } catch {
      // fall through to plain rendering below
    }
  }
  return `<pre class="${PRE_CLASS}"><code>${escapeHtml(code)}</code></pre>`;
}

const HR_RE = /^\s*([-*_])\s*(\1\s*){2,}$/;
const FENCE_OPEN_RE = /^(\s*)```(\S*)\s*$/;
const FENCE_CLOSE_RE = /^\s*```\s*$/;
const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const QUOTE_RE = /^\s*>\s?/;

// Inline-only entry point — for text that's already known to be a single
// flattened line (no headers/lists/fences/blockquotes of its own), e.g.
// `EngineStatusEvidence.excerpt` (server/api/engine-status's own
// whitespace-flattened ~280-char slice of ENGINE_GAPS.md prose, per
// `.claude/contracts/engine-status-schema.md`). Renders just
// bold/italic/strikethrough/code/link spans, no `<p>`/block wrapper — the
// caller supplies its own container element.
export function renderMarkdownInline(text: string): string {
  return renderInline(text);
}

export function renderMarkdown(md: string): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;
    if (line.trim() === '') {
      i++;
      continue;
    }

    const fenceOpen = line.match(FENCE_OPEN_RE);
    if (fenceOpen) {
      const lang = fenceOpen[2] ?? '';
      i++;
      const codeLines: string[] = [];
      while (i < lines.length && !FENCE_CLOSE_RE.test(lines[i]!)) {
        codeLines.push(lines[i]!);
        i++;
      }
      i++; // skip closing fence (or EOF if the file has an unterminated fence)
      out.push(renderCodeBlock(codeLines.join('\n'), lang));
      continue;
    }

    if (HR_RE.test(line)) {
      out.push('<hr>');
      i++;
      continue;
    }

    const heading = line.match(HEADING_RE);
    if (heading) {
      const level = heading[1]!.length;
      out.push(`<h${level}>${renderInline(heading[2]!.trim())}</h${level}>`);
      i++;
      continue;
    }

    if (QUOTE_RE.test(line)) {
      const quoteLines: string[] = [];
      while (i < lines.length && QUOTE_RE.test(lines[i]!)) {
        quoteLines.push(lines[i]!.replace(QUOTE_RE, ''));
        i++;
      }
      out.push(`<blockquote>${renderInline(quoteLines.join(' '))}</blockquote>`);
      continue;
    }

    if (LIST_MARKER.test(line)) {
      const { html, next } = parseList(lines, i);
      out.push(html);
      i = next;
      continue;
    }

    const paraLines: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i]!.trim() !== '' &&
      !LIST_MARKER.test(lines[i]!) &&
      !FENCE_OPEN_RE.test(lines[i]!) &&
      !HEADING_RE.test(lines[i]!) &&
      !QUOTE_RE.test(lines[i]!) &&
      !HR_RE.test(lines[i]!)
    ) {
      paraLines.push(lines[i]!);
      i++;
    }
    out.push(`<p>${renderInline(paraLines.join(' ').trim())}</p>`);
  }

  return out.join('\n');
}
