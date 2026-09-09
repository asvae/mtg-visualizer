<script setup lang="ts">
// Keyword/mechanic coverage suite page — one real, engine-piloted replay
// per keyword/mechanic (functional-model/keywords/registry.ts), reusing the
// SAME ScenarioReplay.vue the per-card detail page's own Scenarios tab
// already uses (see that component's own props). A `not_implemented` entry
// has no replay at all — shown (via KeywordEntryCard.vue) as a plain,
// honest "not yet implemented" note instead, only when FIN-relevant.
//
// Sidebar-nav + content layout (not a stacked list of independently
// collapsible cards): sidebar lists every entry (grouped
// evergreen-then-set-specific), clicking one navigates to its own slug URL
// (see the 2026-09-09 routing note below) and KeywordEntryCard renders ONLY
// that one entry's content in the main pane — single selection, no
// multi-open state.
//
// 2026-09-09: registry.ts grew from a 15-entry FIN-only subset to the full
// historical MTG taxonomy (369 entries, 356 of them set-specific) — this
// pass adds the sidebar search box (client-side substring filter over
// `title`, case-insensitive, applied within each group so the
// evergreen-first grouping survives) and the `handleReviewed` bridge that
// lets KeywordEntryCard's own confirm button flip an entry from
// `ai_reviewed` to `human_reviewed` in place (mutates the matching object
// inside `data.value` directly — same "no full refetch for one field"
// convention the per-card page's own `toggleReviewStatus` uses — so
// re-selecting the entry later, or the sidebar dot, reflects the update
// without a page reload).
//
// Sidebar perf: considered virtualizing the now-356-entry set-specific
// list (vs the ~14 it used to be) but measured no jank — it's a flat list
// of plain `<button>`s with no per-row images/computation, well within
// what Vue/the DOM handles fine unvirtualized; skipped adding a
// virtualization library for this size rather than pre-optimizing.
//
// 2026-09-09: per-keyword URL routing — this file moved from a plain
// `index.vue` to Nuxt's optional-catch-all `[[slug]].vue` (a single file
// handles both the bare `/app/keywords` route, `route.params.slug`
// undefined, and `/app/keywords/<slug>`, same page/fetch/sidebar, just a
// different initial selection) rather than splitting into two files that'd
// each need their own copy of this same fetch+sidebar. `slugifyKeywordTitle`
// (app/lib/keywordSlug.ts) is the ONE slug scheme, run in both directions —
// sidebar links generate a slug from `entry.title`, and the incoming route
// param is resolved back by slugifying every loaded entry's own title and
// matching against that (never attempting to reverse a slug into a title).
// `selectedEntry` is now a plain computed off (data, route param) — no
// separate `selectedKey` ref to keep in sync with the URL — an unmatched or
// absent slug just falls back to the first entry, same "always something
// selected once data loads" behavior the bare route already had.
import { computed, ref } from 'vue';
import type { KeywordPageEntry } from '../../../../server/api/keywords/index.get';
import type { ReviewStatus } from '../../../types';
import { slugifyKeywordTitle } from '../../../lib/keywordSlug';

definePageMeta({ layout: 'graph' });

const route = useRoute();
const { data, pending, error } = useFetch<KeywordPageEntry[]>('/api/keywords');

const searchQuery = ref('');
const normalizedQuery = computed(() => searchQuery.value.trim().toLowerCase());
function matchesQuery(entry: KeywordPageEntry): boolean {
  return !normalizedQuery.value || entry.title.toLowerCase().includes(normalizedQuery.value);
}

const evergreen = computed(() => (data.value ?? []).filter((e) => e.category === 'evergreen' && matchesQuery(e)));
const finMechanics = computed(() => (data.value ?? []).filter((e) => e.category === 'set-specific' && matchesQuery(e)));

// `[[slug]].vue`'s own param — a plain string for a real slug segment,
// undefined for the bare `/app/keywords` route (vue-router never produces
// an array here, this isn't a repeatable `[...slug]` catch-all).
const routeSlug = computed(() => (typeof route.params.slug === 'string' ? route.params.slug : undefined));

const selectedEntry = computed(() => {
  const entries = data.value ?? [];
  if (!entries.length) return null;
  if (routeSlug.value) {
    const match = entries.find((e) => slugifyKeywordTitle(e.title) === routeSlug.value);
    if (match) return match;
  }
  // No slug (bare route), or a slug that matched nothing (stale/typo'd
  // link) — same fallback either way: the first entry, never a hard error.
  return entries[0]!;
});

// Sidebar click navigates to the entry's own slug URL (so back/forward walk
// between keywords) instead of just mutating local state — `selectedEntry`
// above then re-resolves once the route itself changes.
function selectEntry(entry: KeywordPageEntry) {
  navigateTo(`/app/keywords/${slugifyKeywordTitle(entry.title)}`);
}

function handleReviewed(status: ReviewStatus) {
  if (selectedEntry.value) selectedEntry.value.status = status;
}
</script>

<template>
  <div class="relative flex min-h-0 flex-1">
    <div v-if="pending" class="p-6 text-xs text-muted italic">Loading…</div>
    <div v-else-if="error" class="p-6 text-xs text-error">Failed to load: {{ error.message }}</div>

    <template v-else>
      <nav class="flex w-[240px] min-w-[240px] flex-col overflow-y-auto border-r border-border-subtle bg-panel p-2.5">
        <h1 class="mb-1 px-1.5 text-sm font-semibold text-text">Keyword & mechanic coverage</h1>
        <p class="mb-3 px-1.5 text-[11px] leading-relaxed text-muted">
          One real, engine-piloted playthrough per keyword/mechanic — proving the engine genuinely enforces that rule.
        </p>

        <UInput
          v-model="searchQuery"
          class="mb-3"
          placeholder="Search keywords…"
          icon="i-lucide-search"
          autocomplete="off"
          size="sm"
        >
          <template v-if="searchQuery" #trailing>
            <UButton icon="i-lucide-x" color="neutral" variant="link" size="xs" aria-label="Clear search" @click="searchQuery = ''" />
          </template>
        </UInput>

        <div v-if="evergreen.length" class="mb-3">
          <div class="mb-1 px-1.5 text-[11px] font-semibold tracking-wide text-muted uppercase">Evergreen keywords</div>
          <button
            v-for="entry in evergreen"
            :key="entry.key"
            type="button"
            class="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1.5 text-left text-xs"
            :class="selectedEntry?.key === entry.key ? 'bg-surface text-text' : 'text-muted hover:bg-surface/50 hover:text-text'"
            @click="selectEntry(entry)"
          >
            <span class="truncate">{{ entry.title }}</span>
            <span
              class="ml-auto h-1.5 w-1.5 shrink-0 rounded-full"
              :class="entry.status !== 'not_implemented' ? 'bg-produce' : 'bg-consume'"
              :title="entry.status !== 'not_implemented' ? 'Covered' : 'Gap — not yet implemented'"
            />
          </button>
        </div>

        <div v-if="finMechanics.length">
          <div class="mb-1 px-1.5 text-[11px] font-semibold tracking-wide text-muted uppercase">Set-specific keywords & mechanics</div>
          <button
            v-for="entry in finMechanics"
            :key="entry.key"
            type="button"
            class="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1.5 text-left text-xs"
            :class="selectedEntry?.key === entry.key ? 'bg-surface text-text' : 'text-muted hover:bg-surface/50 hover:text-text'"
            @click="selectEntry(entry)"
          >
            <span class="truncate">{{ entry.title }}</span>
            <span
              class="ml-auto h-1.5 w-1.5 shrink-0 rounded-full"
              :class="entry.status !== 'not_implemented' ? 'bg-produce' : 'bg-consume'"
              :title="entry.status !== 'not_implemented' ? 'Covered' : 'Gap — not yet implemented'"
            />
          </button>
        </div>

        <p v-if="!evergreen.length && !finMechanics.length" class="px-1.5 text-[11px] text-muted italic">No keywords match “{{ searchQuery }}”.</p>
      </nav>

      <div class="min-h-0 flex-1 overflow-y-auto p-6">
        <div class="mx-auto max-w-4xl">
          <KeywordEntryCard v-if="selectedEntry" :key="selectedEntry.key" :entry="selectedEntry" @reviewed="handleReviewed" />
          <p v-else class="text-xs text-muted italic">Pick a keyword from the sidebar.</p>
        </div>
      </div>
    </template>
  </div>
</template>
