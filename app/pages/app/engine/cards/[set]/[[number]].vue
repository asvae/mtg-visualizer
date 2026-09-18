<script setup lang="ts">
// Per-card status — one of the three primary `/app/engine/*` console tabs
// (see EngineConsoleTabs.vue's own header). Was the standalone `/app/status`
// page's 50-per-row HEATMAP GRID (one tiny colored square per card, hover
// tooltip, click-to-peek); this route replaced that page entirely with the
// SAME sidebar-nav + detail-pane shell every other tab uses.
//
// 2026-09-18, later same day, TWO structural changes together:
//
// 1. **Route moved `/app/engine/sets` -> `/app/engine/cards`** (nav label
//    was already "Cards" from an earlier commit; only the real route/path
//    segment changes now) — see `EngineConsoleTabs.vue`'s updated
//    `to`/`match`.
//
// 2. **Real two-segment dynamic route: `/app/engine/cards/<set>/<number>`**
//    (previously a single optional `[[slug]]` segment holding just the
//    collector number, `SET` tracked as a plain client-side ref restored
//    from `localStorage`). Explicit user rationale: once more than one set
//    is selectable (FDN alongside FIN, see below), a bare collector number
//    is ambiguous — card identity on this tab is genuinely `(set, number)`,
//    not `number` alone. File layout: `[set]/[[number]].vue` (this file,
//    `[set]` REQUIRED) + a bare `index.vue` sibling that redirects
//    `/app/engine/cards` (no segments at all) to whichever set was last
//    viewed. `definePageMeta({ key: ... })` below keys this whole page
//    component on `:set` specifically (NOT `:number`) — switching sets is a
//    full remount (fresh `useStatusFilterList` state, fresh filter-option
//    set, matching the OLD behavior's own "a set switch invalidates
//    anything accumulated for the previous set" rule), while switching
//    cards within the SAME set (clicking a different sidebar row) reuses
//    the same instance and syncs via a plain route-param watcher, same
//    convention `app/pages/app/engine/keywords/[[slug]].vue` established
//    first for the single-segment tabs.
//
// **`fin` vs `fdn` are two GENUINELY DIFFERENT per-card questions, rendered
// via explicit branches below, not one generalized "any set" rendering** —
// see `server/api/card-status/[set].get.ts`'s own header for the full
// "why fdn needed a real second branch, not a generic fold" rationale.
// `fin`'s per-card question is real fact-authoring/provenance/text-coverage
// completeness (`functional-model/card-status.ts`'s 8-bucket classifier).
// `fdn`'s is "what stage of the two-tier authoring PIPELINE is this card
// at" (`functional-model/pipeline-status.ts`) — FDN cards have no Facts/
// synergy.json at all by design, so FIN's own filter-option wording
// ("Fully covered" = "every fact is recognizer-derived...") would be
// actively misleading for an FDN entry. Rather than hunt for wording
// general enough to honestly describe both (there isn't much shared
// meaning beyond the bare color names), `STATUS_OPTIONS` below is one of
// two distinct, hand-written arrays chosen by `SET` — same "two real
// branches, not a fake generalization" decision the API route already
// made.
//
// **FDN detail pane is deliberately MINIMAL, not `CardDetailTabs.vue`**
// (explicit scope decision, flagged rather than silently solved): that
// shared component (`GET /api/card/:set/:number`) assumes a full FIN-style
// card — Facts/synergy/scenarios/etc — and would 404/error on a real FDN
// card, which has none of that. Making it FDN-aware is real scope for a
// later Workstream 5 UI decision, out of scope here. Instead: clicking an
// FDN card shows its own real `definition.ts` source (via the SAME
// generic, already-existing `GET /api/engine-status/source` route
// Features/Predicates use for THEIR own source citations — no new route
// needed, `readFunctionalModelFile` is scoped to all of `functional-model/`,
// not just what Features/Predicates cite) plus its pipeline-status
// `reasons` — real content, not a stub, just narrower than FIN's own
// tabbed view. Chosen over disabling the click entirely because the real
// content was already one `EngineConsoleCodeSection` + a reasons list away,
// genuinely less total work than building a disabled-with-a-note state AND
// still useful today (a reviewer can read exactly what the agent wrote).
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { onReviewStatusChanged } from '../../../../../composables/useReviewStatusBus';
import type { ReviewStatusChange } from '../../../../../composables/useReviewStatusBus';
import { useStatusFilterList } from '../../../../../composables/useStatusFilterList';
import type { StatusFilterOption } from '../../../../../composables/useStatusFilterList';
import type { CardResponse } from '../../../../../lib/cardResponse';
import { statusBadgeStyle } from '../../../../../lib/badgeColor';
import type { CardStatusPageEntry } from '../../../../../../server/api/card-status/[set].get';
import type { SourceFileResult } from '../../../../../../functional-model/source-files';

const route = useRoute();
// Keys this whole page component on `:set` — see this file's own header,
// point 2, for why (full remount on a set switch, reused instance across a
// mere card-within-the-same-set change).
definePageMeta({ layout: 'graph', key: (r) => (typeof r.params.set === 'string' ? r.params.set : 'fin') });

// Fixed for this component instance's entire lifetime (guaranteed by the
// `key` above) — a plain captured string, not a ref; template bindings
// read it directly like any other setup-scope value.
const SET = typeof route.params.set === 'string' ? route.params.set : 'fin';
const IS_FDN = SET === 'fdn';

interface CardStatusFile {
  generatedAt: string;
  set: string;
  cards: CardStatusPageEntry[];
}

const ENGINE_SETS_LAST_SET_KEY = 'engine-sets-last-set';
onMounted(() => {
  if (typeof localStorage !== 'undefined') localStorage.setItem(ENGINE_SETS_LAST_SET_KEY, SET);
});

const { data: availableSets } = useFetch<string[]>('/api/card-status/sets');
// A stale/typed-by-hand :set that no longer has real data falls back to the
// first real available set instead of silently 404ing/erroring forever.
watch(
  availableSets,
  (sets) => {
    if (sets?.length && !sets.includes(SET)) navigateTo(`/app/engine/cards/${sets[0]}`, { replace: true });
  },
  { immediate: true },
);

const { data: statusFile, pending: statusPending, error: statusError } = useFetch<CardStatusFile>(`/api/card-status/${SET}`, {
  key: `card-status-${SET}`,
});

// Cheap same-tab optimistic overlay on top of the server response, keyed by
// collector number — NOT persisted, NOT re-fetched. Only ever populated by
// `applyReviewStatusChange` below, which only ever fires for real `fin`
// review-status events (`change.set !== SET` short-circuits it for `fdn`,
// which has no such review mechanism at all) — harmlessly inert on this
// route when `IS_FDN`.
const statusOverrides = ref<Record<string, CardStatusPageEntry>>({});

const rawCards = computed<CardStatusPageEntry[]>(() =>
  (statusFile.value?.cards ?? []).map((entry) => statusOverrides.value[entry.number] ?? entry),
);

function baseReasonText(reasons: string[]): string {
  return (reasons[0] ?? '').replace(/; human-reviewed$/, '').replace(/; flagged with a known caveat:.*$/, '');
}
function applyReviewStatusChange(change: ReviewStatusChange) {
  if (IS_FDN || change.set !== SET) return;
  const entry = statusOverrides.value[change.number] ?? statusFile.value?.cards.find((c) => c.number === change.number);
  if (!entry) return;
  const narrowEligible = entry.baseline === 'blue';
  if (change.review === 'human' && narrowEligible) {
    const caveat = change.reviewCaveat?.trim();
    const truncatedCaveat = caveat && caveat.length > 200 ? `${caveat.slice(0, 199)}…` : caveat;
    const color: CardStatusPageEntry['color'] = truncatedCaveat ? 'yellow' : 'green';
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

// Two genuinely different filter-option vocabularies — see this file's own
// header for why. Colors kept byte-for-byte identical to Predicates'/
// Features' own `STATUS_OPTIONS` (the shared gray/purple/blue/yellow/green
// hexes) on purpose.
const STATUS_OPTIONS_FIN: StatusFilterOption<CardStatusPageEntry['color']>[] = [
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
// FDN's own real 5-state PIPELINE-STAGE vocabulary (`functional-model/
// pipeline-status.ts`) — no `re-review` (that value doesn't exist on this
// axis at all). Wording describes "how far along the authoring pipeline
// is," genuinely different from FIN's fact-authoring-completeness meaning
// above even where a color name is shared.
const STATUS_OPTIONS_FDN: StatusFilterOption<CardStatusPageEntry['color']>[] = [
  { value: 'gray', label: 'Not started', color: '#6b7280', description: 'No functional-model/fdn-cards/ folder for this card yet, or the transcription step hasn’t been attempted.' },
  {
    value: 'purple',
    label: 'Blocked',
    color: '#a855f7',
    description: 'The agent’s transcription hit a real, detected engine-capacity/vocabulary gap — see the card’s own reasons for exactly which construct.',
  },
  {
    value: 'blue',
    label: 'Transcribed',
    color: '#3b82f6',
    description: 'The agent completed transcription and it passed the deterministic schema-validation gate. Not yet human-reviewed.',
  },
  { value: 'yellow', label: 'Not ok', color: '#eab308', description: 'A human reviewed this transcription and found it wrong — see its own review note.' },
  { value: 'green', label: 'Ok', color: '#22c55e', description: 'A human reviewed this transcription and confirmed it.' },
];
const STATUS_OPTIONS = IS_FDN ? STATUS_OPTIONS_FDN : STATUS_OPTIONS_FIN;

// Real FIN collector numbers aren't a clean contiguous 1-306 run (bonus/
// showcase-sheet numbering runs past 306 with gaps, plus one lettered entry,
// "99b"); FDN's own numbering is a separate, independent sequence — this
// same leading-integer-then-string-tiebreak sort works for either.
function sortKey(n: string): [number, string] {
  const match = /^(\d+)(.*)$/.exec(n);
  return match ? [Number(match[1]), match[2] ?? ''] : [Number.POSITIVE_INFINITY, n];
}

const list = useStatusFilterList<CardStatusPageEntry, CardStatusPageEntry['color']>({
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
  storageKey: `engine-console-filters-cards-${SET}`,
});

const selectedEntry = computed(() => list.selected.value);
function statusMeta(color: CardStatusPageEntry['color']) {
  return STATUS_OPTIONS.find((o) => o.value === color)!;
}

useHead({ title: computed(() => (selectedEntry.value ? `Engine | Cards | ${selectedEntry.value.name}` : 'Engine | Cards')) });

// --- URL deep-linking (route <-> selection sync) for `:number` only — `:set`
// itself never changes without a full remount, see this file's own header.
const routeNumber = computed(() => (typeof route.params.number === 'string' ? route.params.number : undefined));
watch(
  [routeNumber, rawCards],
  ([number, entries]) => {
    if (!number || !entries.length) return;
    const match = entries.find((e) => e.number === number);
    if (match) list.selectedKey.value = match.number;
  },
  { immediate: true },
);

function pickEntry(entry: CardStatusPageEntry) {
  navigateTo(`/app/engine/cards/${SET}/${encodeURIComponent(entry.number)}`);
}
function goPrev() {
  const idx = list.selectedIndex.value;
  if (idx > 0) pickEntry(list.visible.value[idx - 1]!);
}
function goNext() {
  const idx = list.selectedIndex.value;
  if (idx >= 0 && idx < list.visible.value.length - 1) pickEntry(list.visible.value[idx + 1]!);
}

// --- FIN detail pane: real card content inline, via `CardDetailTabs.vue`
// (the shared component `CardPeekPanel.vue`/the standalone `/app/card/
// [set]/[number]` page both also mount) — unchanged from before this task,
// just gated off entirely for `fdn` (see `selectedCardKey` below).
const responseCache = new Map<string, CardResponse>();
const cardData = ref<CardResponse | null>(null);
const cardLoading = ref(false);
const cardNotFound = ref(false);

const selectedCardKey = computed(() => (!IS_FDN && selectedEntry.value ? `${SET}/${selectedEntry.value.number}` : null));

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

// --- FDN detail pane: minimal, real content — see this file's own header
// for why this isn't `CardDetailTabs.vue`. Reuses the SAME generic
// `GET /api/engine-status/source` route Features/Predicates already use
// for their own source citations (`readFunctionalModelFile` is scoped to
// all of `functional-model/`, not an allowlist of paths those two tabs
// happen to cite) — no new server route needed.
const fdnSourceCache = new Map<string, SourceFileResult>();
const fdnSource = ref<SourceFileResult | null>(null);
const fdnSourceLoading = ref(false);

const selectedFdnSlug = computed(() => (IS_FDN ? selectedEntry.value?.slug : undefined));
watch(
  selectedFdnSlug,
  async (slug) => {
    fdnSource.value = null;
    if (!slug) return;
    const cached = fdnSourceCache.get(slug);
    if (cached) {
      fdnSource.value = cached;
      return;
    }
    fdnSourceLoading.value = true;
    try {
      const path = `functional-model/fdn-cards/${slug}/definition.ts`;
      const result = await $fetch<SourceFileResult>('/api/engine-status/source', { query: { path } });
      fdnSourceCache.set(slug, result);
      fdnSource.value = result;
    } finally {
      fdnSourceLoading.value = false;
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
        <h1 class="text-sm font-semibold text-text">{{ IS_FDN ? 'FDN authoring-pipeline status' : 'Fact-authoring status' }}</h1>
        <USelect
          :model-value="SET"
          @update:model-value="(v) => navigateTo(`/app/engine/cards/${String(v)}`)"
          :items="(availableSets ?? [SET]).map((s) => ({ label: s.toUpperCase(), value: s }))"
          size="xs"
          class="ml-auto w-20"
        />
      </div>
      <p class="mb-3 px-1.5 text-[11px] leading-relaxed text-muted">
        <template v-if="IS_FDN">
          One row per real FDN-set card, colored by which stage of the two-tier sink-only-synergy-model authoring
          pipeline it's reached — most are "Not started" until the pipeline actually processes them.
        </template>
        <template v-else>
          One row per card, colored by how far its functional-model facts have come along, on the same
          gray/purple/blue/yellow/green axis as
          <NuxtLink to="/app/engine/predicates" class="text-text underline">Predicate status</NuxtLink> and
          <NuxtLink to="/app/engine/features" class="text-text underline">Feature status</NuxtLink> — see
          <code class="rounded bg-bg px-1 py-0.5">scripts/AI_FACT_ELIMINATION_PROCESS.md</code> for the underlying
          per-card fact-authoring process.
        </template>
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
        :key-of="(e: CardStatusPageEntry) => e.number"
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
      <template v-if="selectedEntry">
        <!-- FDN: minimal detail view, real content, deliberately NOT
             `CardDetailTabs.vue` — see this file's own header. -->
        <div v-if="IS_FDN" class="rounded-md border border-border-subtle bg-panel p-3">
          <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span class="text-sm font-semibold text-text">{{ selectedEntry.name }}</span>
            <span class="text-[11px] text-muted">#{{ selectedEntry.number }}</span>
            <UBadge :style="statusBadgeStyle(statusMeta(selectedEntry.color).color)" size="sm" variant="solid">
              {{ statusMeta(selectedEntry.color).label }}
            </UBadge>
          </div>
          <p class="mt-2 text-[11px] leading-relaxed text-muted italic">
            Minimal FDN detail view — the full Facts/synergy/scenarios tabs FIN cards get aren't built for FDN's
            sink-only model yet (real, separate, not-yet-started UI scope).
          </p>
          <div v-if="selectedEntry.reasons.length" class="mt-3 border-t border-border-subtle pt-3">
            <div class="text-[10px] font-semibold tracking-wide text-muted uppercase">Reasons</div>
            <ul class="mt-1.5 flex flex-col gap-1">
              <li v-for="(r, i) in selectedEntry.reasons" :key="i" class="text-[11px] leading-relaxed text-muted">{{ r }}</li>
            </ul>
          </div>
          <div class="mt-3 border-t border-border-subtle pt-3">
            <div class="text-[10px] font-semibold tracking-wide text-muted uppercase">Source</div>
            <div class="mt-1.5">
              <EngineConsoleCodeSection
                title="definition.ts"
                language="ts"
                :loading="fdnSourceLoading"
                :result="fdnSource"
                not-found-label="No functional-model/fdn-cards/<slug>/definition.ts yet."
                default-open
              />
            </div>
          </div>
        </div>
        <!-- FIN: real full card content inline, via `CardDetailTabs.vue`. -->
        <template v-else>
          <CardImageSkeleton v-if="cardLoading && !cardData" />
          <p v-else-if="cardNotFound" class="text-xs text-muted italic">Card not found.</p>
          <CardDetailTabs v-else-if="cardData" :data="cardData" :set="SET" :number="selectedEntry.number" />
        </template>
      </template>
      <p v-else class="text-xs text-muted italic">Pick a card from the sidebar.</p>
    </template>
  </EngineConsoleShell>
</template>
