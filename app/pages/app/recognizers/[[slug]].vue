<script setup lang="ts">
// Recognizer coverage + individual review page — mirrors
// app/pages/app/keywords/[[slug]].vue's own sidebar-nav + content layout and
// review-status pattern closely, but for the automated-facts-extraction
// "recognizer" catalog (functional-model/recognizers/, see
// functional-model/PRD_AUTOMATED_AUTHORING.md) instead of the
// keyword/mechanic registry.
//
// One real difference from the keywords page: a recognizer id (e.g.
// `destroy-effect-structural`) IS already a real URL-safe slug — no
// separate title<->slug scheme (keywordSlug.ts) is needed; the sidebar
// links straight to `/app/recognizers/<id>` and the route param is matched
// against `entry.id` directly.
//
// Also no evergreen/set-specific split (keywords' own grouping) — recognizers
// have no such distinction, so the sidebar is one flat list of all 5.
import { computed } from 'vue';
import type { RecognizerPageEntry } from '../../../../server/api/recognizers/index.get';
import type { ReviewStatus } from '../../../types';

definePageMeta({ layout: 'graph' });

const route = useRoute();
const { data, pending, error } = useFetch<RecognizerPageEntry[]>('/api/recognizers');

// `[[slug]].vue`'s own param — a plain string for a real slug segment,
// undefined for the bare `/app/recognizers` route.
const routeSlug = computed(() => (typeof route.params.slug === 'string' ? route.params.slug : undefined));

const selectedEntry = computed(() => {
  const entries = data.value ?? [];
  if (!entries.length) return null;
  if (routeSlug.value) {
    const match = entries.find((e) => e.id === routeSlug.value);
    if (match) return match;
  }
  // No slug (bare route), or a slug that matched nothing (stale/typo'd
  // link) — same fallback either way: the first entry, never a hard error.
  return entries[0]!;
});

function selectEntry(entry: RecognizerPageEntry) {
  navigateTo(`/app/recognizers/${entry.id}`);
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
        <h1 class="mb-1 px-1.5 text-sm font-semibold text-text">Recognizer coverage</h1>
        <p class="mb-3 px-1.5 text-[11px] leading-relaxed text-muted">
          Automated-fact-extraction rules (functional-model/recognizers/) — one real, mechanically-applied recognizer per row, reviewed against every card it currently matches.
        </p>

        <button
          v-for="entry in data ?? []"
          :key="entry.id"
          type="button"
          class="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1.5 text-left text-xs"
          :class="selectedEntry?.id === entry.id ? 'bg-surface text-text' : 'text-muted hover:bg-surface/50 hover:text-text'"
          @click="selectEntry(entry)"
        >
          <span class="truncate">{{ entry.title }}</span>
          <span class="shrink-0 rounded bg-bg px-1 py-0.5 text-[10px] text-muted">{{ entry.matchCount }}</span>
          <span
            class="h-1.5 w-1.5 shrink-0 rounded-full"
            :class="entry.status === 'human_reviewed' ? 'bg-produce' : 'bg-consume'"
            :title="entry.status === 'human_reviewed' ? 'Human-reviewed' : 'AI-reviewed (draft)'"
          />
        </button>
      </nav>

      <div class="min-h-0 flex-1 overflow-y-auto p-6">
        <div class="mx-auto max-w-4xl">
          <RecognizerEntryCard v-if="selectedEntry" :key="selectedEntry.id" :entry="selectedEntry" @reviewed="handleReviewed" />
          <p v-else class="text-xs text-muted italic">Pick a recognizer from the sidebar.</p>
        </div>
      </div>
    </template>
  </div>
</template>
