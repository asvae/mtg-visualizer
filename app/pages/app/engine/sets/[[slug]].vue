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
//
// 2026-09-18: URL-based deep-linking (route file renamed `index.vue` ->
// `[[slug]].vue`), same route-<->selection sync convention
// `app/pages/app/engine/keywords/[[slug]].vue` established first — see that
// file's own header for the full rationale (import direction only; the
// composable's own internal "current selection got filtered out" reset
// never navigates). Slug here is the card's own collector `number` (already
// a short, URL-safe alnum string — "1", "150", "99b", ...) — this axis's
// own equivalent of Predicates' `slug`/Features' `key`, no derivation
// needed. Deliberately does NOT also encode `SET` into the URL (out of this
// task's scope, and this page's own last-picked-set already persists
// separately via `localStorage`) — a slug that doesn't resolve under
// whatever set is currently active (e.g. a link saved under `fin`, opened
// while `SET` has since been switched to a different set) just falls
// through to the default first-visible-entry selection, same as any other
// unknown/stale slug on this page.
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
//
// 2026-09-18: this tab no longer filters/colors on the raw 8-bucket
// `status` value directly — it now renders under the SAME shared
// gray/purple/blue/yellow/green display axis `/app/engine/predicates` and
// `/app/engine/features` already use (`CardStatusColor`/`CardStatusBaseline`
// below), fed by `GET /api/card-status/:set`'s own `baseline`/`color`
// fields (added the same day — see that route's own doc comment). `status`
// (the real 8-bucket classification) is kept on the type purely for parity
// with the served shape / potential future debugging use; nothing in this
// page's own template reads it anymore. See
// `functional-model/card-status.ts`'s own `cardStatusBaseline`/
// `cardStatusColor` doc comment for the full bucket-by-bucket fold
// rationale (that file, not this one, is the source of truth for the
// mapping — this page only ever consumes the already-translated result).
type CardStatusBucket = 'verified' | 'uncertain' | 're-review' | 'green' | 'yellow' | 'orange' | 'red' | 'gray';
type CardStatusBaseline = 'gray' | 'purple' | 'blue';
type CardStatusColor = 'gray' | 'purple' | 'blue' | 'yellow' | 'green' | 're-review';
interface CardStatusEntry {
  number: string;
  name: string;
  status: CardStatusBucket;
  reasons: string[];
  baseline: CardStatusBaseline;
  color: CardStatusColor;
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
// Same review-bus-driven optimistic-overlay behavior the old 8-bucket
// version of this function had (see git history for that version) — just
// re-expressed on the new `baseline`/`color` fields instead of the raw
// `status` value, per `functional-model/card-status.ts`'s own
// `cardStatusBaseline`/`cardStatusColor` mapping: "would otherwise be
// green/verified/uncertain/re-review" collapses exactly onto
// `baseline === 'blue'` under that mapping, and the `status` field itself
// is deliberately left untouched by this override (nothing reads it here
// anymore, and this bus has no way to recompute the real 8-bucket value
// anyway — only the derived `color` needs to visibly react).
function applyReviewStatusChange(change: ReviewStatusChange) {
  if (change.set !== SET.value) return;
  const entry = statusOverrides.value[change.number] ?? statusFile.value?.cards.find((c) => c.number === change.number);
  if (!entry) return;
  const narrowEligible = entry.baseline === 'blue';
  if (change.review === 'human' && narrowEligible) {
    const caveat = change.reviewCaveat?.trim();
    const truncatedCaveat = caveat && caveat.length > 200 ? `${caveat.slice(0, 199)}…` : caveat;
    const color: CardStatusColor = truncatedCaveat ? 'yellow' : 'green';
    const suffix = truncatedCaveat ? `; flagged with a known caveat: ${truncatedCaveat}` : '; human-reviewed';
    statusOverrides.value = {
      ...statusOverrides.value,
      [change.number]: { ...entry, color, reasons: [`${baseReasonText(entry.reasons)}${suffix}`] },
    };
  } else if (change.review === 'ai' && (entry.color === 'green' || entry.color === 'yellow')) {
    statusOverrides.value = {
      ...statusOverrides.value,
      [change.number]: { ...entry, color: 'blue', reasons: [baseReasonText(entry.reasons)] },
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

// Same 5-state gray/purple/blue/yellow/green vocabulary + hex colors
// `/app/engine/predicates` and `/app/engine/features` already use for their
// own `STATUS_OPTIONS` — kept byte-for-byte identical (colors + the
// "computed baseline vs. human-review overlay" split) on purpose, so the
// three tabs read as one consistent axis rather than three similar-but-not-
// quite-matching ones. Labels are this axis's own wording (not copy-pasted
// from those two) since "no predicate module yet" / "gap not closed" don't
// make sense for a per-card fact-authoring question — see
// `functional-model/card-status.ts`'s own `cardStatusBaseline`/
// `cardStatusColor` doc comment for exactly which of the real 8 buckets
// folds into which of these 5.
const STATUS_OPTIONS: StatusFilterOption<CardStatusColor>[] = [
  { value: 'gray', label: 'Not authored yet', color: '#6b7280', description: 'No real facts extracted yet for this card — or a structural, not-yet-modeled construct blocks it entirely.' },
  {
    value: 'purple',
    label: 'Incomplete',
    color: '#a855f7',
    description: 'Has some real facts, but not yet BOTH fully recognizer-derived (no hand/AI-authored fact) AND oracle-text-covered — see the card’s own reasons for which.',
  },
  {
    value: 'blue',
    label: 'Fully covered',
    color: '#3b82f6',
    description: 'Every fact is recognizer-derived and oracle text is fully covered. No current human-review opinion attached (or a prior one went stale after the content changed and was dropped).',
  },
  { value: 'yellow', label: 'Rejected', color: '#eab308', description: 'Human-reviewed and REJECTED with one specific, known conceptual gap — see the card’s own caveat note.' },
  { value: 'green', label: 'Confirmed', color: '#22c55e', description: 'Human-reviewed and confirmed as-is.' },
  {
    value: 're-review',
    label: 'Needs re-review',
    color: '#7dd3fc',
    description: 'A human previously confirmed this card, but its facts/synergy data has since drifted from what was confirmed — the old confirmation is stale and needs another look.',
  },
];

// Real FIN collector numbers aren't a clean contiguous 1-306 run (bonus/
// showcase-sheet numbering runs past 306 with gaps, plus one lettered entry,
// "99b") — sort on the parsed leading integer, string tiebreak for a shared
// number, same as the old grid page.
function sortKey(n: string): [number, string] {
  const match = /^(\d+)(.*)$/.exec(n);
  return match ? [Number(match[1]), match[2] ?? ''] : [Number.POSITIVE_INFINITY, n];
}

const list = useStatusFilterList<CardStatusEntry, CardStatusColor>({
  items: rawCards,
  keyOf: (e) => e.number,
  statusOf: (e) => e.color,
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
function statusMeta(color: CardStatusColor) {
  return STATUS_OPTIONS.find((o) => o.value === color)!;
}

// --- URL deep-linking (route <-> selection sync) — see this file's own
// header for the convention/slug-source note.
const route = useRoute();
const routeSlug = computed(() => (typeof route.params.slug === 'string' ? route.params.slug : undefined));
watch(
  [routeSlug, rawCards],
  ([slug, entries]) => {
    if (!slug || !entries.length) return;
    const match = entries.find((e) => e.number === slug);
    if (match) list.selectedKey.value = match.number;
  },
  { immediate: true },
);

function pickEntry(entry: CardStatusEntry) {
  navigateTo(`/app/engine/sets/${encodeURIComponent(entry.number)}`);
}
function goPrev() {
  const idx = list.selectedIndex.value;
  if (idx > 0) pickEntry(list.visible.value[idx - 1]!);
}
function goNext() {
  const idx = list.selectedIndex.value;
  if (idx >= 0 && idx < list.visible.value.length - 1) pickEntry(list.visible.value[idx + 1]!);
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
    @prev="goPrev"
    @next="goNext"
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
        One row per card, colored by how far its functional-model facts have come along, on the same
        gray/purple/blue/yellow/green axis as
        <NuxtLink to="/app/engine/predicates" class="text-text underline">Predicate status</NuxtLink> and
        <NuxtLink to="/app/engine/features" class="text-text underline">Feature status</NuxtLink> — see
        <code class="rounded bg-bg px-1 py-0.5">scripts/AI_FACT_ELIMINATION_PROCESS.md</code> for the underlying
        per-card fact-authoring process.
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
      >
        <template #help>
          <EngineConsoleStatusHelp :status-options="STATUS_OPTIONS" />
        </template>
      </EngineConsoleStatusFilterControls>

      <EngineConsoleEntryListPanel
        :entries="list.visible.value"
        :key-of="(e: CardStatusEntry) => e.number"
        :selected-key="list.selectedKey.value"
        empty-message="No cards match the current search/filters."
        @select="pickEntry"
      >
        <template #row="{ entry }">
          <span class="h-1.5 w-1.5 shrink-0 rounded-full" :style="{ background: statusMeta(entry.color).color }" />
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
