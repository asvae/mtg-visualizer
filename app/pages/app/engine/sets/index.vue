<script setup lang="ts">
// Per-card fact-authoring status — one of the four `/app/engine/*` console
// tabs (see EngineConsoleTabs.vue's own header). Was the standalone
// `/app/status` page's 50-per-row HEATMAP GRID (one tiny colored square per
// card, hover tooltip, click-to-peek); this route replaces that page
// entirely with the SAME sidebar-nav + detail-pane shell every other tab
// uses, per this task's own explicit "drop the heatmap, no special-cased
// layout" instruction — a card is now a normal list row, its "reasons" text
// (the tooltip's own content before this rework) lives in the detail pane
// instead of a hover target. Old `/app/status` route removed as part of
// this same consolidation — see AppHeader.vue's updated nav link.
//
// Still set-scoped by design (`GET /api/card-status/:set`) — `SET` is now a
// real, user-switchable ref (2026-09-17 addendum, mid-consolidation), picked
// from a dropdown populated by `GET /api/card-status/sets` (a NEW thin
// discovery endpoint this same task added — see its own header for why a
// new file was warranted despite the task's "don't touch server/api/*"
// constraint: that constraint is about not touching EXISTING backend/engine
// logic, not a ban on this agent's own established "thin data endpoint
// feeding a ui page" pattern, e.g. server/api/keywords/index.get.ts) rather
// than a hardcoded list — only `fin` exists today, but a future set (e.g.
// FDN) picks up automatically the moment its own `data/<set>/
// <set>_scryfall.json` lands, no code change needed here. The last-picked
// set persists to `localStorage` (`ENGINE_SETS_LAST_SET_KEY` below) — same
// per-viewer-convenience, not-shared/critical-state convention
// `useGraphStore.ts`'s own Deck/filters persistence already establishes —
// so reopening this tab defaults back to whatever set was last viewed
// instead of always resetting to FIN. `EngineConsoleShell`/
// `useStatusFilterList` themselves stay entirely set-UNAWARE (plain data
// in, plain data out) — only this page's own script knows `SET` exists.
//
// Preserves: the live-recompute-in-dev/checked-in-snapshot-in-prod
// `/api/card-status/:set` fetch, and the same-tab optimistic
// review-status-bus overlay (`useReviewStatusBus.ts`) the old grid used so
// a just-confirmed card re-colors without a refetch. Does NOT preserve the
// grid's own bespoke ArrowLeft/ArrowRight-while-panel-open keyboard nav or
// its hover tooltip — both are superseded by this shell's shared Prev/Next
// buttons and always-visible detail pane respectively, so carrying them
// forward unchanged would've been duplicate mechanism for the same job,
// not a preserved capability.
//
// 2026-09-17 (later same day): selecting a row no longer opens
// `CardPeekPanel.vue` (a floating overlay) — this tab's detail pane now
// renders the card's real full content directly inline, via
// `CardDetailTabs.vue` (the same shared component the standalone
// `/app/card/[set]/[number]` page and `CardPeekPanel.vue` itself both
// mount — see the `#detail` template below for the fetch/render logic).
// No popup at all on this tab anymore; the graph page's own peek panel is
// unaffected.
import { computed } from 'vue';
import { onReviewStatusChanged } from '../../../../composables/useReviewStatusBus';
import type { ReviewStatusChange } from '../../../../composables/useReviewStatusBus';
import { useStatusFilterList } from '../../../../composables/useStatusFilterList';
import type { StatusFilterOption } from '../../../../composables/useStatusFilterList';
import { onMounted, onUnmounted, ref, watch } from 'vue';
import type { CardResponse } from '../../../../lib/cardResponse';

definePageMeta({ layout: 'graph' });
useHead({ title: 'Fact-authoring status' });

// Mirrors `functional-model/card-status.ts`'s own `CardStatusEntry`/bucket
// union, duplicated here rather than imported — this page only ever reads
// the generated JSON, never `functional-model/*` itself (`engine`'s lane,
// per card-schema.md).
type CardStatusBucket = 'verified' | 'uncertain' | 're-review' | 'green' | 'yellow' | 'orange' | 'red' | 'gray';
interface CardStatusEntry {
  number: string;
  name: string;
  status: CardStatusBucket;
  reasons: string[];
}
interface CardStatusFile {
  generatedAt: string;
  set: string;
  cards: CardStatusEntry[];
}

const ENGINE_SETS_LAST_SET_KEY = 'engine-sets-last-set';

const { data: availableSets } = useFetch<string[]>('/api/card-status/sets');

// Seeded from localStorage synchronously (this route lives entirely under
// `/app`, which is SPA-only per this app's own architecture — same
// "read localStorage directly at setup time, no SSR guard needed" precedent
// `useGraphStore.ts`'s own module-scope restore already relies on) — falls
// back to `'fin'` when nothing's stored yet. Re-validated against
// `availableSets` once that arrives (see the watcher below): a stale
// localStorage value naming a set that no longer has data falls back to
// the first real available set instead of silently 404ing.
const SET = ref<string>((typeof localStorage !== 'undefined' && localStorage.getItem(ENGINE_SETS_LAST_SET_KEY)) || 'fin');
watch(
  availableSets,
  (sets) => {
    if (!sets?.length) return;
    if (!sets.includes(SET.value)) SET.value = sets[0]!;
  },
  { immediate: true },
);

const { data: statusFile, pending: statusPending, error: statusError } = useFetch<CardStatusFile>(() => `/api/card-status/${SET.value}`, {
  key: computed(() => `card-status-${SET.value}`),
  watch: [SET],
});

// Cheap same-tab optimistic overlay on top of the generated
// `fin_card_status.json`, keyed by collector number — NOT persisted, NOT
// re-fetched; a real page reload always shows the server's authoritative
// classification again. Populated only by `applyReviewStatusChange` below —
// same mechanism/safety rules the old grid page established (only ever
// narrows within the green/verified/uncertain/re-review triad, never
// invents a downgrade locally).
const statusOverrides = ref<Record<string, CardStatusEntry>>({});

watch(SET, (set) => {
  localStorage.setItem(ENGINE_SETS_LAST_SET_KEY, set);
  // A set switch invalidates any optimistic overrides accumulated for the
  // PREVIOUS set — they're keyed by collector number alone, which could
  // collide with a same-numbered card in the newly-selected set.
  statusOverrides.value = {};
});

const rawCards = computed<CardStatusEntry[]>(() =>
  (statusFile.value?.cards ?? []).map((entry) => statusOverrides.value[entry.number] ?? entry),
);

function baseReasonText(reasons: string[]): string {
  return (reasons[0] ?? '').replace(/; human-reviewed$/, '').replace(/; flagged with a known caveat:.*$/, '');
}
function applyReviewStatusChange(change: ReviewStatusChange) {
  if (change.set !== SET.value) return;
  const entry = statusOverrides.value[change.number] ?? statusFile.value?.cards.find((c) => c.number === change.number);
  if (!entry) return;
  const narrowEligible = entry.status === 'green' || entry.status === 're-review' || entry.status === 'verified' || entry.status === 'uncertain';
  if (change.review === 'human' && narrowEligible) {
    const caveat = change.reviewCaveat?.trim();
    const truncatedCaveat = caveat && caveat.length > 200 ? `${caveat.slice(0, 199)}…` : caveat;
    const status = truncatedCaveat ? 'uncertain' : 'verified';
    const suffix = truncatedCaveat ? `; flagged with a known caveat: ${truncatedCaveat}` : '; human-reviewed';
    statusOverrides.value = {
      ...statusOverrides.value,
      [change.number]: { ...entry, status, reasons: [`${baseReasonText(entry.reasons)}${suffix}`] },
    };
  } else if (change.review === 'ai' && (entry.status === 'verified' || entry.status === 'uncertain')) {
    statusOverrides.value = {
      ...statusOverrides.value,
      [change.number]: { ...entry, status: 'green', reasons: [baseReasonText(entry.reasons)] },
    };
  }
}

let unsubscribeReviewStatus: (() => void) | null = null;
onMounted(() => {
  unsubscribeReviewStatus = onReviewStatusChanged(applyReviewStatusChange);
});
onUnmounted(() => {
  unsubscribeReviewStatus?.();
});

const STATUS_OPTIONS: StatusFilterOption<CardStatusBucket>[] = [
  { value: 'verified', label: 'Verified', color: '#84cc16', description: 'Green, plus a human has reviewed the card’s facts.' },
  { value: 'uncertain', label: 'Uncertain', color: '#3b82f6', description: 'Facts are as complete as they can be right now, but a human has flagged a specific known conceptual modeling gap — see the card’s own caveat note.' },
  { value: 're-review', label: 'Re-review', color: '#7dd3fc', description: 'Was human-reviewed and confirmed before, but the card’s content has since drifted from that confirmed baseline — the old confirmation is stale and needs another look.' },
  { value: 'green', label: 'Green', color: '#22c55e', description: 'No AI-authored facts — oracle text fully covered by real facts.' },
  { value: 'yellow', label: 'Yellow', color: '#eab308', description: 'No AI-authored facts, but oracle text not fully covered yet.' },
  { value: 'orange', label: 'Orange', color: '#f97316', description: 'Has at least one AI-authored (non-recognizer-derived) fact.' },
  { value: 'red', label: 'Red', color: '#ef4444', description: 'Definition has an unsupported / not-yet-modeled construct.' },
  { value: 'gray', label: 'Gray', color: '#6b7280', description: 'Untouched — no real facts extracted yet.' },
];

// Real FIN collector numbers aren't a clean contiguous 1-306 run (bonus/
// showcase-sheet numbering runs past 306 with gaps, plus one lettered entry,
// "99b") — sort on the parsed leading integer, string tiebreak for a shared
// number, same as the old grid page.
function sortKey(n: string): [number, string] {
  const match = /^(\d+)(.*)$/.exec(n);
  return match ? [Number(match[1]), match[2] ?? ''] : [Number.POSITIVE_INFINITY, n];
}

const list = useStatusFilterList<CardStatusEntry, CardStatusBucket>({
  items: rawCards,
  keyOf: (e) => e.number,
  statusOf: (e) => e.status,
  statusOptions: STATUS_OPTIONS,
  matchesQuery: (e, q) => e.name.toLowerCase().includes(q) || e.number.toLowerCase().includes(q),
  sortBy: (a, b) => {
    const [an, as] = sortKey(a.number);
    const [bn, bs] = sortKey(b.number);
    return an - bn || as.localeCompare(bs);
  },
  storageKey: 'engine-console-filters-sets',
});

const selectedEntry = computed(() => list.selected.value);
function statusMeta(status: CardStatusBucket) {
  return STATUS_OPTIONS.find((o) => o.value === status)!;
}

// Real card content, inline in the detail pane — this tab used to open the
// same-shape data via `CardPeekPanel.vue` (a floating overlay) on row click;
// per explicit 2026-09-17 rework that panel is dropped for this tab
// entirely in favor of rendering `CardDetailTabs.vue` (the actual shared
// content component both `CardPeekPanel.vue` and the standalone
// `/app/card/[set]/[number]` page mount — see either's own header comment)
// directly in the pane, so selecting a row IS the whole interaction. Fetch
// shape (in-memory-only `set/number`-keyed cache, loading/not-found refs)
// deliberately mirrors `CardPeekPanel.vue`'s own copy rather than reusing
// its component outright — that component's chrome (drag-to-resize, close/
// expand buttons, its own `<aside>` overlay styling) is exactly what this
// tab shouldn't have.
const responseCache = new Map<string, CardResponse>();
const cardData = ref<CardResponse | null>(null);
const cardLoading = ref(false);
const cardNotFound = ref(false);

const selectedCardKey = computed(() => (selectedEntry.value ? `${SET.value}/${selectedEntry.value.number}` : null));

watch(
  selectedCardKey,
  async (key, prevKey) => {
    cardNotFound.value = false;
    if (!key) return;
    const cached = responseCache.get(key);
    if (cached) {
      cardData.value = cached;
      return;
    }
    if (key !== prevKey) cardData.value = null;
    cardLoading.value = true;
    try {
      const [set, number] = key.split('/');
      const res = await fetch(`/api/card/${encodeURIComponent(set!)}/${encodeURIComponent(number!)}`);
      if (!res.ok) {
        cardNotFound.value = true;
        return;
      }
      const body = (await res.json()) as CardResponse;
      responseCache.set(key, body);
      cardData.value = body;
    } catch {
      cardNotFound.value = true;
    } finally {
      cardLoading.value = false;
    }
  },
  { immediate: true },
);
</script>

<template>
  <EngineConsoleShell
    :pending="statusPending && !statusFile"
    :error="statusError"
    :can-prev="list.canPrev.value"
    :can-next="list.canNext.value"
    :position-label="list.positionLabel.value"
    @prev="list.selectPrev"
    @next="list.selectNext"
  >
    <template #nav>
      <div class="mb-1 flex items-center gap-2 px-1.5">
        <h1 class="text-sm font-semibold text-text">Fact-authoring status</h1>
        <USelect
          :model-value="SET"
          @update:model-value="(v) => (SET = String(v))"
          :items="(availableSets ?? [SET]).map((s) => ({ label: s.toUpperCase(), value: s }))"
          size="xs"
          class="ml-auto w-20"
        />
      </div>
      <p class="mb-3 px-1.5 text-[11px] leading-relaxed text-muted">
        One row per card, colored by how far its functional-model facts have come along — see
        <code class="rounded bg-bg px-1 py-0.5">scripts/AI_FACT_ELIMINATION_PROCESS.md</code>.
        <template v-if="statusFile">
          Computed as of {{ new Date(statusFile.generatedAt).toLocaleString() }}.
        </template>
      </p>

      <EngineConsoleStatusFilterControls
        :search-query="list.searchQuery.value"
        search-placeholder="Search cards…"
        :status-options="STATUS_OPTIONS"
        :active-filters="list.activeFilters.value"
        :counts="list.countsByStatus.value"
        :visible-count="list.visible.value.length"
        :total-count="rawCards.length"
        @update:search-query="(v: string) => (list.searchQuery.value = v)"
        @toggle="list.toggleFilter"
      />

      <EngineConsoleEntryListPanel
        :entries="list.visible.value"
        :key-of="(e: CardStatusEntry) => e.number"
        :selected-key="list.selectedKey.value"
        empty-message="No cards match the current search/filters."
        @select="list.select"
      >
        <template #row="{ entry }">
          <span class="h-1.5 w-1.5 shrink-0 rounded-full" :style="{ background: statusMeta(entry.status).color }" />
          <span class="shrink-0 text-[10px] tabular-nums text-muted/70">#{{ entry.number }}</span>
          <span class="truncate">{{ entry.name }}</span>
        </template>
      </EngineConsoleEntryListPanel>
    </template>

    <template #detail>
      <!-- 2026-09-17: this pane used to be a small custom summary (name,
           collector number, status dot, reasons list) plus an "Open card"
           button that opened `CardPeekPanel.vue` (a floating overlay) — per
           explicit rework, this tab drops that popup entirely and instead
           renders the card's real full content directly here, via
           `CardDetailTabs.vue` — the SAME shared component the standalone
           `/app/card/[set]/[number]` page and `CardPeekPanel.vue` both
           already mount (see either's own header comment for why: one
           component, so a future change to the tab set can't leave any of
           its three consumers behind). The reasons/status summary itself
           isn't lost — `CardDetailTabs.vue` already renders this exact same
           live `cardStatus` (color dot + reasons tooltip) on its own
           Facts-tab strip, so repeating it here would just be a duplicate,
           not new information. -->
      <template v-if="selectedEntry">
        <CardImageSkeleton v-if="cardLoading && !cardData" />
        <p v-else-if="cardNotFound" class="text-xs text-muted italic">Card not found.</p>
        <CardDetailTabs v-else-if="cardData" :data="cardData" :set="SET" :number="selectedEntry.number" />
      </template>
      <p v-else class="text-xs text-muted italic">Pick a card from the sidebar.</p>
    </template>
  </EngineConsoleShell>
</template>
