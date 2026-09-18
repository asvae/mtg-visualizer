<script setup lang="ts">
// Small shared Markdown -> HTML view — wraps app/lib/markdown.ts's
// `renderMarkdown()` plus the same heading/paragraph/list/table/blockquote/
// code-fence styling app/pages/docs/[[slug]].vue's own `.docs-body` style
// block already established for that page's real project-doc rendering
// (README/NEXT_STEPS/WISHLIST/SET_STATUS/docs/prds/*/functional-model/*.md).
// Extracted here (2026-09-19) for CardDetailTabs.vue's new "Notes" tab
// (`functional-model/fdn-cards/<slug>/NOTES.md`, served via
// `FunctionalModelData.notes`) rather than a second inline copy of that
// same block — this is now the one place that styling lives; a future third
// Markdown-rendering surface should reuse this component too rather than
// copying it again. Deliberately NOT wired into `app/pages/docs/[[slug]].vue`
// itself in this change (out of this task's own card-page-only scope) —
// that page keeps its own local `.docs-body` block unchanged for now.
import { computed } from 'vue';
import { renderMarkdown } from '../lib/markdown';

const props = defineProps<{ markdown: string }>();
const html = computed(() => renderMarkdown(props.markdown));
</script>

<template>
  <div class="markdown-view" v-html="html" />
</template>

<style scoped>
/* Rendered markdown comes in via v-html (renderMarkdown in app/lib/
   markdown.ts returns a raw HTML string), so none of it carries Vue's
   scoped `data-v-xxxx` attribute — every selector below targeting that
   content needs `:deep()` (or, for the hljs spans specifically,
   `:global()`, since those are nested one level deeper inside `:deep()`'s
   own reach) rather than relying on scoping to narrow it down naturally.
   Same palette/sizing as app/pages/docs/[[slug]].vue's own `.docs-body`
   block — kept in sync by eye, not by a shared constant, same as that
   page's own hljs mapping already duplicates FunctionalModelScript.vue/
   JsonHighlight.vue's. */
.markdown-view :deep(h1) {
  margin: 0 0 0.75rem;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text);
}
.markdown-view :deep(h2) {
  margin: 1.5rem 0 0.75rem;
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
  border-top: 1px solid var(--color-border-subtle);
  padding-top: 1rem;
}
.markdown-view :deep(h1:first-child),
.markdown-view :deep(h2:first-child) {
  border-top: none;
  padding-top: 0;
}
.markdown-view :deep(h3) {
  margin: 1.1rem 0 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text);
}
.markdown-view :deep(h4),
.markdown-view :deep(h5),
.markdown-view :deep(h6) {
  margin: 0.9rem 0 0.5rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-muted);
}
.markdown-view :deep(p) {
  margin: 0 0 0.85rem;
  font-size: 0.8125rem;
  line-height: 1.65;
  color: var(--color-text);
}
.markdown-view :deep(ul),
.markdown-view :deep(ol) {
  margin: 0 0 0.85rem;
  padding-left: 1.25rem;
  font-size: 0.8125rem;
  line-height: 1.65;
  color: var(--color-text);
}
.markdown-view :deep(ul) {
  list-style: disc;
}
.markdown-view :deep(ol) {
  list-style: decimal;
}
.markdown-view :deep(li) {
  margin: 0.15rem 0;
}
.markdown-view :deep(li) :deep(ul),
.markdown-view :deep(li) :deep(ol) {
  margin: 0.25rem 0 0;
}
.markdown-view :deep(a) {
  color: var(--color-produce);
  text-decoration: underline;
  text-underline-offset: 2px;
}
.markdown-view :deep(strong) {
  font-weight: 600;
  color: var(--color-text);
}
.markdown-view :deep(em) {
  font-style: italic;
}
.markdown-view :deep(del) {
  text-decoration: line-through;
  color: var(--color-muted);
}
.markdown-view :deep(blockquote) {
  margin: 0 0 0.85rem;
  padding: 0.4rem 0.85rem;
  border-left: 2px solid var(--color-border);
  color: var(--color-muted);
  font-size: 0.8125rem;
}
.markdown-view :deep(hr) {
  margin: 1.25rem 0;
  border: none;
  border-top: 1px solid var(--color-border-subtle);
}
.markdown-view :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.75rem;
  background: var(--color-surface);
  border-radius: 0.25rem;
  padding: 0.1rem 0.3rem;
  color: var(--color-text);
}
.markdown-view :deep(pre.docs-code) {
  margin: 0 0 0.85rem;
}
.markdown-view :deep(pre.docs-code code) {
  background: none;
  padding: 0;
}
.markdown-view :deep(table) {
  margin: 0 0 0.85rem;
  border-collapse: collapse;
  font-size: 0.75rem;
  line-height: 1.5;
  color: var(--color-text);
}
.markdown-view :deep(th),
.markdown-view :deep(td) {
  border: 1px solid var(--color-border-subtle);
  padding: 0.3rem 0.5rem;
  text-align: left;
  vertical-align: top;
}
.markdown-view :deep(th) {
  background: var(--color-surface);
  font-weight: 600;
}

/* Same hljs token -> palette mapping FunctionalModelScript.vue/
   JsonHighlight.vue/app/pages/docs/[[slug]].vue already established. */
.markdown-view :global(.hljs-keyword),
.markdown-view :global(.hljs-built_in) {
  color: #9dcacf;
}
.markdown-view :global(.hljs-title.function_),
.markdown-view :global(.hljs-title.class_) {
  color: #d8ab88;
}
.markdown-view :global(.hljs-string),
.markdown-view :global(.hljs-attr) {
  color: #9ecfa0;
}
.markdown-view :global(.hljs-number),
.markdown-view :global(.hljs-literal),
.markdown-view :global(.hljs-type) {
  color: #cfa9d8;
}
.markdown-view :global(.hljs-comment) {
  font-style: italic;
  color: var(--color-muted);
}
.markdown-view :global(.hljs-punctuation),
.markdown-view :global(.hljs-operator) {
  color: var(--color-text);
}
</style>
