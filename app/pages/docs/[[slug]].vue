<script setup lang="ts">
// Dev-only doc browser — lists + renders this repo's own markdown docs
// (README/NEXT_STEPS/WISHLIST/SET_STATUS, docs/prds/*, functional-model/*)
// in-browser instead of hunting through files. Never meant to exist in a
// deployed copy of the app (there's no reader-facing reason for it, and
// `functional-model/ENGINE_GAPS.md` etc. are internal design notes, not
// user-facing content) — gated the same way the per-card page's own
// dev-only review-status button already is (`import.meta.dev`, see that
// page's `isDev`), rather than an opt-in env-var flag: no reason to ever
// want this in a real deployment even behind a flag, so the simpler
// always-off-in-prod check fits better here. `import.meta.dev` is a
// Vite/Nuxt compile-time constant
// — `false` in a production build, so this whole branch (and the page
// around it) is dead code there; thrown as a 404 rather than silently
// rendering blank so a stray direct hit behaves like the route doesn't
// exist. The two API routes this page calls (server/api/docs/*) carry the
// same-spirit `NODE_ENV === 'production'` refusal independently, since
// they're reachable regardless of which page asked.
if (!import.meta.dev) {
  throw createError({ statusCode: 404, statusMessage: 'Page not found' });
}

import { computed } from 'vue';
import { renderMarkdown } from '../../lib/markdown';

interface DocListEntry {
  slug: string;
  title: string;
  group: string;
}
interface DocContent extends DocListEntry {
  content: string;
}

useHead({ title: 'Docs (dev only)' });

const route = useRoute();
const { data: docList, pending: listPending, error: listError } = await useFetch<DocListEntry[]>('/api/docs');

// Registry order (not alphabetical) is the intended reading order within
// each group — `docs/prds/01-...` before `02-...`, etc. — so grouping just
// walks the already-ordered list once rather than re-sorting it.
const groups = computed(() => {
  const out: { group: string; entries: DocListEntry[] }[] = [];
  for (const entry of docList.value ?? []) {
    let g = out.find((x) => x.group === entry.group);
    if (!g) {
      g = { group: entry.group, entries: [] };
      out.push(g);
    }
    g.entries.push(entry);
  }
  return out;
});

const routeSlug = computed(() => (typeof route.params.slug === 'string' ? route.params.slug : undefined));
const activeSlug = computed(() => {
  const list = docList.value ?? [];
  if (!list.length) return undefined;
  if (routeSlug.value && list.some((d) => d.slug === routeSlug.value)) return routeSlug.value;
  return list[0]!.slug;
});
function selectDoc(entry: DocListEntry) {
  navigateTo(`/docs/${entry.slug}`);
}

// `useAsyncData` (not `useFetch`'s own reactive-URL form) — content per doc
// is only ever needed for whichever ONE is currently selected (a couple of
// these files, ENGINE_GAPS.md/SYNERGY_DESIGN.md, are large enough that
// fetching all of them up front would be wasteful), and unlike a plain
// `watch(..., {immediate: true})` calling `$fetch` itself, `useAsyncData` is
// the form Nuxt's SSR actually awaits before finishing the render.
//
// Key MUST be templated on the slug, not a fixed string. Verified (headless
// Playwright repro) that clicking a different sidebar entry does NOT update
// this component's route params in place — Nuxt fully unmounts and remounts
// the page for every `/docs/<slug>` navigation here, re-running this whole
// `<script setup>` block from scratch with the new slug already resolved. A
// fixed key meant the fresh instance's call found the *previous* instance's
// cached entry under that same key in Nuxt's payload/data cache and reused
// it without re-fetching — sidebar clicks silently kept the old doc on
// screen. `watch: [activeSlug]` is kept as a harmless no-op safety net for
// the (currently unobserved) case where an update ever happens without a
// remount; the per-slug key is what actually fixes the bug.
const { data: activeDoc, pending: docPending, error: docError } = await useAsyncData<DocContent | null>(
  `docs-active-doc-${activeSlug.value ?? 'none'}`,
  () => (activeSlug.value ? $fetch<DocContent>(`/api/docs/${activeSlug.value}`) : Promise.resolve(null)),
  { watch: [activeSlug] }
);

const renderedHtml = computed(() => (activeDoc.value ? renderMarkdown(activeDoc.value.content) : ''));
</script>

<template>
  <div class="flex h-screen flex-col">
    <div class="flex items-center gap-3 border-b border-border-subtle bg-panel px-4 py-2.5">
      <NuxtLink to="/app" class="text-xs text-muted hover:text-text">&larr; Back to app</NuxtLink>
      <span class="text-xs font-semibold text-text">Project docs</span>
      <span class="rounded bg-warn/20 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-warn uppercase">Dev only</span>
    </div>

    <div v-if="listPending" class="p-6 text-xs text-muted italic">Loading…</div>
    <div v-else-if="listError" class="p-6 text-xs text-error">Failed to load doc list: {{ listError.message }}</div>

    <div v-else class="relative flex min-h-0 flex-1">
      <nav class="flex w-[240px] min-w-[240px] flex-col overflow-y-auto border-r border-border-subtle bg-panel p-2.5">
        <div v-for="g in groups" :key="g.group" class="mb-3">
          <div class="mb-1 px-1.5 text-[11px] font-semibold tracking-wide text-muted uppercase">{{ g.group }}</div>
          <button
            v-for="entry in g.entries"
            :key="entry.slug"
            type="button"
            class="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1.5 text-left text-xs"
            :class="activeSlug === entry.slug ? 'bg-surface text-text' : 'text-muted hover:bg-surface/50 hover:text-text'"
            @click="selectDoc(entry)"
          >
            <span class="truncate">{{ entry.title }}</span>
          </button>
        </div>
      </nav>

      <div class="min-h-0 flex-1 overflow-y-auto p-6">
        <div class="docs-body mx-auto max-w-3xl">
          <div v-if="docPending" class="text-xs text-muted italic">Loading…</div>
          <div v-else-if="docError" class="text-xs text-error">Failed to load doc: {{ docError.message }}</div>
          <div v-else-if="renderedHtml" v-html="renderedHtml" />
          <p v-else class="text-xs text-muted italic">Pick a doc from the sidebar.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Rendered markdown comes in via v-html (renderMarkdown in
   app/lib/markdown.ts returns a raw HTML string), so none of it carries
   Vue's scoped `data-v-xxxx` attribute — every selector below targeting
   that content needs `:deep()` (or, for the hljs spans specifically,
   `:global()`, since those are nested one level deeper inside `:deep()`'s
   own reach) rather than relying on scoping to narrow it down naturally. */
.docs-body :deep(h1) {
  margin: 0 0 0.75rem;
  font-size: 1.375rem;
  font-weight: 600;
  color: var(--color-text);
}
.docs-body :deep(h2) {
  margin: 1.75rem 0 0.75rem;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-text);
  border-top: 1px solid var(--color-border-subtle);
  padding-top: 1.25rem;
}
.docs-body :deep(h1:first-child),
.docs-body :deep(h2:first-child) {
  border-top: none;
  padding-top: 0;
}
.docs-body :deep(h3) {
  margin: 1.25rem 0 0.5rem;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--color-text);
}
.docs-body :deep(h4),
.docs-body :deep(h5),
.docs-body :deep(h6) {
  margin: 1rem 0 0.5rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-muted);
}
.docs-body :deep(p) {
  margin: 0 0 0.85rem;
  font-size: 0.8125rem;
  line-height: 1.65;
  color: var(--color-text);
}
.docs-body :deep(ul),
.docs-body :deep(ol) {
  margin: 0 0 0.85rem;
  padding-left: 1.25rem;
  font-size: 0.8125rem;
  line-height: 1.65;
  color: var(--color-text);
}
.docs-body :deep(ul) {
  list-style: disc;
}
.docs-body :deep(ol) {
  list-style: decimal;
}
.docs-body :deep(li) {
  margin: 0.15rem 0;
}
.docs-body :deep(li) :deep(ul),
.docs-body :deep(li) :deep(ol) {
  margin: 0.25rem 0 0;
}
.docs-body :deep(a) {
  color: var(--color-produce);
  text-decoration: underline;
  text-underline-offset: 2px;
}
.docs-body :deep(strong) {
  font-weight: 600;
  color: var(--color-text);
}
.docs-body :deep(em) {
  font-style: italic;
}
.docs-body :deep(blockquote) {
  margin: 0 0 0.85rem;
  padding: 0.4rem 0.85rem;
  border-left: 2px solid var(--color-border);
  color: var(--color-muted);
  font-size: 0.8125rem;
}
.docs-body :deep(hr) {
  margin: 1.5rem 0;
  border: none;
  border-top: 1px solid var(--color-border-subtle);
}
.docs-body :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.75rem;
  background: var(--color-surface);
  border-radius: 0.25rem;
  padding: 0.1rem 0.3rem;
  color: var(--color-text);
}
.docs-body :deep(pre.docs-code) {
  margin: 0 0 0.85rem;
}
.docs-body :deep(pre.docs-code code) {
  background: none;
  padding: 0;
}

/* Same hljs token -> palette mapping FunctionalModelScript.vue/
   JsonHighlight.vue already established — kept local rather than shared,
   same reasoning those two components already give (each caller's mapping
   is a one-off). */
.docs-body :global(.hljs-keyword),
.docs-body :global(.hljs-built_in) {
  color: #9dcacf;
}
.docs-body :global(.hljs-title.function_),
.docs-body :global(.hljs-title.class_) {
  color: #d8ab88;
}
.docs-body :global(.hljs-string),
.docs-body :global(.hljs-attr) {
  color: #9ecfa0;
}
.docs-body :global(.hljs-number),
.docs-body :global(.hljs-literal),
.docs-body :global(.hljs-type) {
  color: #cfa9d8;
}
.docs-body :global(.hljs-comment) {
  font-style: italic;
  color: var(--color-muted);
}
.docs-body :global(.hljs-punctuation),
.docs-body :global(.hljs-operator) {
  color: var(--color-text);
}
</style>
