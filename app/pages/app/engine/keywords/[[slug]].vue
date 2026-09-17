<script setup lang="ts">
// Keyword/mechanic coverage — one of the four `/app/engine/*` console tabs
// (see EngineConsoleTabs.vue's own header). Content-wise this duplicates
// the older standalone `/app/keywords/[[slug]].vue` page (same
// `GET /api/keywords` data, same `KeywordEntryCard` detail renderer, same
// per-entry slug routing) — DELIBERATELY a duplicate, not a replacement:
// per an explicit mid-task correction, the user was still undecided on
// whether keywords belongs folded into this console at all, so
// `/app/keywords` stays in place untouched (still linked from
// AppHeader.vue) alongside this tab, unlike predicates/sets/features whose
// old standalone routes WERE removed as part of this same consolidation.
// Don't delete `/app/keywords/[[slug]].vue` or its AppHeader.vue link
// without a fresh, explicit ask.
//
// New here (this tab didn't exist on the old page): status-filter buttons
// (Covered/Gap, each with its own count) and Prev/Next navigation within
// the current search+filter result — both are this task's own
// shared-shell requirements, layered on top via `useStatusFilterList`.
// Selection still deep-links per-entry (`routeSlug`) same as the old page
// — layered on top of the composable's own plain `selectedKey` ref by
// watching the route rather than the composable growing a second
// "externally driven" selection mode (see useStatusFilterList.ts's own
// header for why). Explicit picks (row click / Prev / Next) always
// `navigateTo` a real slug URL — the ONE case that does NOT navigate is
// the composable's own internal "current selection got filtered out,
// default to the new first visible entry" reset, and only while the route
// itself is still bare (no slug) to begin with, matching the old page's
// own "bare route never auto-redirects to a slug" behavior exactly.
import { computed, watch } from 'vue';
import type { KeywordPageEntry } from '../../../../../server/api/keywords/index.get';
import type { ReviewStatus } from '../../../../types';
import { slugifyKeywordTitle } from '../../../../lib/keywordSlug';
import { useStatusFilterList } from '../../../../composables/useStatusFilterList';
import type { StatusFilterOption } from '../../../../composables/useStatusFilterList';

definePageMeta({ layout: 'graph' });

const route = useRoute();
const { data, pending, error } = useFetch<KeywordPageEntry[]>('/api/keywords');

type CoverageStatus = 'covered' | 'gap';
const STATUS_OPTIONS: StatusFilterOption<CoverageStatus>[] = [
  { value: 'covered', label: 'Covered', color: 'var(--color-produce)', description: 'A real, engine-piloted replay proves the engine enforces this rule.' },
  { value: 'gap', label: 'Gap', color: 'var(--color-consume)', description: 'Not yet implemented.' },
];

const items = computed(() => data.value ?? []);
const list = useStatusFilterList<KeywordPageEntry, CoverageStatus>({
  items,
  keyOf: (e) => e.key,
  statusOf: (e) => (e.status !== 'not_implemented' ? 'covered' : 'gap'),
  statusOptions: STATUS_OPTIONS,
  matchesQuery: (e, q) => e.title.toLowerCase().includes(q),
});

// Evergreen-then-set-specific grouping stays a purely VISUAL split within
// the already search+status-filtered `visible` list — filtering itself
// doesn't care about the grouping, only the sidebar's own rendering does.
const evergreen = computed(() => list.visible.value.filter((e) => e.category === 'evergreen'));
const finMechanics = computed(() => list.visible.value.filter((e) => e.category === 'set-specific'));

const selectedEntry = computed(() => list.selected.value);

// --- Route <-> selection sync (import direction only, see header) --------
const routeSlug = computed(() => (typeof route.params.slug === 'string' ? route.params.slug : undefined));
watch(
  [routeSlug, items],
  ([slug, entries]) => {
    if (!slug || !entries.length) return;
    const match = entries.find((e) => slugifyKeywordTitle(e.title) === slug);
    if (match) list.selectedKey.value = match.key;
  },
  { immediate: true },
);

function pickEntry(entry: KeywordPageEntry) {
  navigateTo(`/app/engine/keywords/${slugifyKeywordTitle(entry.title)}`);
}
function goPrev() {
  const idx = list.selectedIndex.value;
  if (idx > 0) pickEntry(list.visible.value[idx - 1]!);
}
function goNext() {
  const idx = list.selectedIndex.value;
  if (idx >= 0 && idx < list.visible.value.length - 1) pickEntry(list.visible.value[idx + 1]!);
}

function handleReviewed(status: ReviewStatus) {
  if (selectedEntry.value) selectedEntry.value.status = status;
}
</script>

<template>
  <EngineConsoleShell
    :pending="pending"
    :error="error"
    :can-prev="list.canPrev.value"
    :can-next="list.canNext.value"
    :position-label="list.positionLabel.value"
    @prev="goPrev"
    @next="goNext"
  >
    <template #nav>
      <h1 class="mb-1 px-1.5 text-sm font-semibold text-text">Keyword &amp; mechanic coverage</h1>
      <p class="mb-3 px-1.5 text-[11px] leading-relaxed text-muted">
        One real, engine-piloted playthrough per keyword/mechanic — proving the engine genuinely enforces that rule.
      </p>

      <EngineConsoleStatusFilterControls
        :search-query="list.searchQuery.value"
        search-placeholder="Search keywords…"
        :status-options="STATUS_OPTIONS"
        :active-filters="list.activeFilters.value"
        :counts="list.countsByStatus.value"
        :visible-count="list.visible.value.length"
        :total-count="items.length"
        @update:search-query="(v: string) => (list.searchQuery.value = v)"
        @toggle="list.toggleFilter"
      />

      <div v-if="evergreen.length" class="mb-3">
        <div class="mb-1 px-1.5 text-[11px] font-semibold tracking-wide text-muted uppercase">Evergreen keywords</div>
        <EngineConsoleEntryListPanel :entries="evergreen" :key-of="(e: KeywordPageEntry) => e.key" :selected-key="list.selectedKey.value" empty-message="" @select="pickEntry">
          <template #row="{ entry }">
            <span class="truncate">{{ entry.title }}</span>
            <span
              class="ml-auto h-1.5 w-1.5 shrink-0 rounded-full"
              :style="{ background: entry.status !== 'not_implemented' ? 'var(--color-produce)' : 'var(--color-consume)' }"
              :title="entry.status !== 'not_implemented' ? 'Covered' : 'Gap — not yet implemented'"
            />
          </template>
        </EngineConsoleEntryListPanel>
      </div>

      <div v-if="finMechanics.length">
        <div class="mb-1 px-1.5 text-[11px] font-semibold tracking-wide text-muted uppercase">Set-specific keywords &amp; mechanics</div>
        <EngineConsoleEntryListPanel :entries="finMechanics" :key-of="(e: KeywordPageEntry) => e.key" :selected-key="list.selectedKey.value" empty-message="" @select="pickEntry">
          <template #row="{ entry }">
            <span class="truncate">{{ entry.title }}</span>
            <span
              class="ml-auto h-1.5 w-1.5 shrink-0 rounded-full"
              :style="{ background: entry.status !== 'not_implemented' ? 'var(--color-produce)' : 'var(--color-consume)' }"
              :title="entry.status !== 'not_implemented' ? 'Covered' : 'Gap — not yet implemented'"
            />
          </template>
        </EngineConsoleEntryListPanel>
      </div>

      <p v-if="!evergreen.length && !finMechanics.length" class="px-1.5 text-[11px] text-muted italic">No keywords match the current search/filters.</p>
    </template>

    <template #detail>
      <KeywordEntryCard v-if="selectedEntry" :key="selectedEntry.key" :entry="selectedEntry" @reviewed="handleReviewed" />
      <p v-else class="text-xs text-muted italic">Pick a keyword from the sidebar.</p>
    </template>
  </EngineConsoleShell>
</template>
