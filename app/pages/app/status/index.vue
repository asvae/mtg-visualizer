<script setup lang="ts">
// Per-card fact-authoring status dashboard — a "how far along is FIN as a
// whole" heatmap, one small square per card, colored by
// `functional-model/card-status.ts`'s own 8-bucket classification
// (verified/uncertain/re-review/green/yellow/orange/red/gray — `verified`,
// `uncertain`, and `re-review` are all stricter narrowings of green: fully
// complete, plus resp. human-reviewed (`progress.json`'s `review:"human"`),
// human-reviewed-with-a-known-caveat (`reviewCaveat`), or previously
// human-reviewed but since drifted (`review:"regression"`)).
//
// 2026-09-16: fetches LIVE from `GET /api/card-status/:set`
// (`server/api/card-status/[set].get.ts`) instead of statically importing
// the generated `data/<set>/<set>_card_status.json` artifact directly —
// that static import only ever reflected whatever `npm run card-status` had
// last written, so a just-confirmed review (or any other content change)
// didn't show up on this grid until someone manually reran that script; a
// confirmed real bug (fin/1, fin/2, fin/3 review confirmations not
// reflected here). The new route recomputes live in dev (see its own
// header) and falls back to that same checked-in file in production, where
// live recomputation isn't possible — this page itself no longer needs to
// know which of those two happened, it just fetches once per page load.
import { computed, inject, nextTick, onMounted, onUnmounted, ref } from 'vue';
import { computePosition, offset, flip, shift, size } from '@floating-ui/dom';
import { StoreKey } from '../../../composables/useGraphStore';
import { onReviewStatusChanged } from '../../../composables/useReviewStatusBus';
import type { ReviewStatusChange } from '../../../composables/useReviewStatusBus';

definePageMeta({ layout: 'graph' });
useHead({ title: 'Fact-authoring status' });

const store = inject(StoreKey)!;

// Mirrors `functional-model/card-status.ts`'s own `CardStatusEntry`/bucket
// union, duplicated here rather than imported — this page only ever reads
// the generated JSON, never `functional-model/*` itself (that's `engine`'s
// lane, this file just consumes its output, per card-schema.md).
type CardStatusBucket = 'verified' | 'uncertain' | 're-review' | 'green' | 'yellow' | 'orange' | 'red' | 'gray';
interface CardStatusEntry {
  number: string;
  name: string;
  status: CardStatusBucket;
  // On an `uncertain` card, `functional-model/card-status.ts`'s own
  // `classifyCardStatus` already folds a truncated (200-char) copy of
  // `progress.json.reviewCaveat` straight into this array (checked directly
  // against that source, 2026-09-17) — there is no separate `reviewCaveat`
  // field on this entry to read; the caveat is just more `reasons` text.
  reasons: string[];
}
interface CardStatusFile {
  generatedAt: string;
  set: string;
  cards: CardStatusEntry[];
}

// Set-scoped by design (the served payload is genuinely `{generatedAt, set,
// cards}`-shaped per `<set>`) even though only FIN exists today — a second
// set is just a different `SET` value, same route (`server/api/card-status/
// [set].get.ts`) handles any set with a checked-in snapshot or a live FIN-
// shaped source directory.
const SET = 'fin';
// Live per-page-load fetch (2026-09-16, see this file's own header) — same
// `useFetch` convention the card detail page
// (`app/pages/app/card/[set]/[number].vue`) already uses for its own
// server-backed data load. `data` starts `null` until the request settles;
// every computed/template consumer below tolerates that (empty grid, no
// crash) rather than assuming a value is already present the way the old
// static import let this file assume.
const { data: statusFile, pending: statusPending, error: statusError } = useFetch<CardStatusFile>(`/api/card-status/${SET}`, {
  key: `card-status-${SET}`,
});

// Real FIN collector numbers are NOT a clean contiguous 1-306 run (bonus/
// showcase-sheet numbering runs up to 563 with large gaps, and one entry is
// "99b" — confirmed directly against the generated file) — sorting on the
// parsed leading integer (falling back to a string tiebreak for a shared
// number, e.g. a lettered variant) reads as ascending "by collector number"
// without assuming a fixed slot count a real gap-filled grid would need.
function sortKey(n: string): [number, string] {
  const match = /^(\d+)(.*)$/.exec(n);
  return match ? [Number(match[1]), match[2] ?? ''] : [Number.POSITIVE_INFINITY, n];
}
// Cheap same-tab optimistic overlay on top of the generated
// `fin_card_status.json` (see useReviewStatusBus.ts's own header) — keyed
// by collector number (this page is already scoped to one SET's own file,
// same key `CardStatusEntry` itself uses), NOT persisted, NOT re-fetched
// from anywhere; a real page reload always shows the server's authoritative
// classification again. Populated only by `applyReviewStatusChange` below.
const statusOverrides = ref<Record<string, CardStatusEntry>>({});

const sortedCards = computed(() =>
  (statusFile.value?.cards ?? [])
    .map((entry) => statusOverrides.value[entry.number] ?? entry)
    .sort((a, b) => {
      const [an, as] = sortKey(a.number);
      const [bn, bs] = sortKey(b.number);
      return an - bn || as.localeCompare(bs);
    })
);

// Applies a `review` ('ai'/'human') change broadcast by CardDetailTabs.vue's
// Confirm/Unconfirm/"Confirm (Uncertain)" buttons — the ONLY narrowing this
// ever applies optimistically stays within the green/verified/uncertain
// triad (this file's own classifier-mirroring reasons-suffix convention, see
// functional-model/card-status.ts), exactly per this task's own safety rule:
// never invent a downgrade to yellow/orange/red/gray locally, since only the
// real `npm run card-status` regen knows if content genuinely regressed
// further than that. Any other combination (status isn't
// green/verified/uncertain/re-review, or the review value doesn't match the
// direction that status implies) is a deliberate no-op.
// `re-review` -> `verified`/`uncertain` is included alongside plain `green`
// here because a fresh human Confirm on a `re-review` card transitions it
// straight to `verified` (or `uncertain`, 2026-09-17 — a "Confirm
// (Uncertain)" click carries a real `reviewCaveat`) too
// (`.claude/contracts/card-schema.md`'s own `re-review` section) —
// `re-review` itself is never applied optimistically by this function (it's
// written only by the server-side `check-verified-regressions.mjs`
// auto-detection guard, never by these buttons), only consumed as a possible
// upgrade source. `change.reviewCaveat` (2026-09-17) is what distinguishes a
// plain confirm (`verified`) from an "Uncertain confirm" (`uncertain`) — the
// `verified`/`uncertain` entry conditions below also cover moving BETWEEN
// those two directly (adding/clearing a caveat on an already-`human`-
// reviewed card, no `review` value change at all), which the original
// green/re-review-only conditions didn't need to.
function baseReasonText(reasons: string[]): string {
  return (reasons[0] ?? '').replace(/; human-reviewed$/, '').replace(/; flagged with a known caveat:.*$/, '');
}
function applyReviewStatusChange(change: ReviewStatusChange) {
  if (change.set !== SET) return;
  const entry = statusOverrides.value[change.number] ?? statusFile.value?.cards.find((c) => c.number === change.number);
  if (!entry) return;
  const narrowEligible = entry.status === 'green' || entry.status === 're-review' || entry.status === 'verified' || entry.status === 'uncertain';
  if (change.review === 'human' && narrowEligible) {
    const caveat = change.reviewCaveat?.trim();
    // Same truncate-to-200-chars convention `classifyCardStatus` itself uses
    // for this exact suffix (functional-model/card-status.ts's own
    // `truncate(trimmedCaveat, 200)` call) — mirrored here, not re-derived,
    // so the reasons text this override produces matches what a real
    // regen/live-recompute would show.
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

// Fixed-shape grid: exactly 50 squares per row, split into 5 visually-gapped
// clusters of 10 within each row. `row.start`/`row.end` are POSITION in the
// sorted list (1-based, e.g. "1-50", "51-100", ...), not literal collector
// numbers — a literal-number range label would misrepresent this corpus (see
// `sortKey`'s own comment: numbers run to 563 with large gaps, plus one
// lettered entry), so "position 1-50 of 306" is the only framing that stays
// accurate regardless of what the underlying numbers actually are. The last
// row's own `end` is just its real last index (e.g. "301-306"), not padded
// out to a full 50.
const ROW_SIZE = 50;
const CLUSTER_SIZE = 10;
interface StatusRow {
  start: number;
  end: number;
  clusters: CardStatusEntry[][];
}
const rows = computed<StatusRow[]>(() => {
  const cards = sortedCards.value;
  const result: StatusRow[] = [];
  for (let i = 0; i < cards.length; i += ROW_SIZE) {
    const rowCards = cards.slice(i, i + ROW_SIZE);
    const clusters: CardStatusEntry[][] = [];
    for (let j = 0; j < rowCards.length; j += CLUSTER_SIZE) {
      clusters.push(rowCards.slice(j, j + CLUSTER_SIZE));
    }
    result.push({ start: i + 1, end: i + rowCards.length, clusters });
  }
  return result;
});

const STATUS_META: Record<CardStatusBucket, { color: string; label: string; description: string }> = {
  verified: { color: '#84cc16', label: 'Verified', description: 'Green, plus a human has reviewed the card’s facts.' },
  uncertain: { color: '#3b82f6', label: 'Uncertain', description: 'Facts are as complete as they can be right now, but a human has flagged a specific known conceptual modeling gap — see the card’s own caveat note.' },
  're-review': { color: '#7dd3fc', label: 'Re-review', description: 'Was human-reviewed and confirmed before, but the card’s content has since drifted from that confirmed baseline — the old confirmation is stale and needs another look.' },
  green: { color: '#22c55e', label: 'Green', description: 'No AI-authored facts — oracle text fully covered by real facts.' },
  yellow: { color: '#eab308', label: 'Yellow', description: 'No AI-authored facts, but oracle text not fully covered yet.' },
  orange: { color: '#f97316', label: 'Orange', description: 'Has at least one AI-authored (non-recognizer-derived) fact.' },
  red: { color: '#ef4444', label: 'Red', description: 'Definition has an unsupported / not-yet-modeled construct.' },
  gray: { color: '#6b7280', label: 'Gray', description: 'Untouched — no real facts extracted yet.' },
};
// Order: verified > uncertain > re-review > green > ... — `uncertain` sits
// above `re-review` even though both narrow an otherwise-`green` outcome,
// because `uncertain`'s caveat is a CURRENTLY-accurate human signal about
// this exact content, while `re-review` means a past human confirmation has
// been invalidated by since-detected drift (the very thing the caveat's
// "nothing else is wrong" claim would no longer be safe to trust either, see
// `.claude/contracts/card-schema.md`'s own priority note) — so `re-review`
// reads as the less-trustworthy of the two, but still clearly above a plain
// never-reviewed `green`.
const STATUS_ORDER: CardStatusBucket[] = ['verified', 'uncertain', 're-review', 'green', 'yellow', 'orange', 'red', 'gray'];

function openCard(entry: CardStatusEntry) {
  store.openCardPanel(SET, entry.number);
}

// Persistent "this square's card is the one currently open in the peek
// panel" visual state — distinct from the transient hover/focus styling
// below, and must survive the mouse moving away. `store.panelCardKey` is
// the SAME `${set}/${collectorNumber}` key CardPeekPanel.vue itself reads
// (see its own `panelKey` computed) to decide what's open — reading it
// here rather than keeping a separate local "last clicked" ref means this
// also stays correct if the panel is closed via its own close button (not
// just via clicking a different square) or the `?card=` query param is
// edited/cleared some other way, since `panelCardKey` IS that param, not a
// mirror of it.
function isSelected(entry: CardStatusEntry): boolean {
  return store.panelCardKey.value === `${SET}/${entry.number}`;
}

// --- Left/Right arrow-key navigation while the peek panel is open --------
// Lives here, not in CardPeekPanel.vue itself, deliberately: the panel
// component is shared with app/pages/app/index.vue (the main graph page,
// a force-directed layout with no single "next card" notion) and has no
// access to — nor should it need to know about — THIS page's own flat,
// filtered/sorted grid order. This page already owns exactly that list
// (`sortedCards`, the same flattened order the grid below renders into rows
// of clusters — a row's clusters are plain slices of it, so it already IS
// the visual left-to-right/top-to-bottom reading order) and already owns
// the open/select mechanism (`openCard`/`isSelected` above, both keyed off
// the same `store.panelCardKey`/`store.openCardPanel` the click handler
// uses) — arrow-key nav is just those two wired together, no new mechanism.
const currentGridIndex = computed(() => {
  const key = store.panelCardKey.value;
  if (!key) return -1;
  return sortedCards.value.findIndex((entry) => `${SET}/${entry.number}` === key);
});

// Clamp at either edge (do nothing past the first/last card) rather than
// wrap — simpler, and matches the full card-detail page's own
// Previous/Next, which also stops dead at either end of its own list
// instead of cycling back around.
function onKeydown(e: KeyboardEvent) {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  if (currentGridIndex.value < 0) return; // panel not open on one of this grid's own cards
  // Guard against an editable element (e.g. AppHeader's SearchBox, present
  // on every page via layouts/graph.vue) currently having focus — arrow
  // keys there mean "move the text cursor," not "navigate the grid."
  const active = document.activeElement;
  const tag = active?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || (active as HTMLElement | null)?.isContentEditable) return;
  const delta = e.key === 'ArrowLeft' ? -1 : 1;
  const target = sortedCards.value[currentGridIndex.value + delta];
  if (!target) return;
  openCard(target);
}
onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));

// --- Hover tooltip -----------------------------------------------------
// Same computePosition/offset/flip/shift/size recipe TooltipView.vue
// (cursor-anchored, for the graph's own card hover) and
// FunctionalModelText.vue (element-anchored, its own oracle-text phrase
// hover — UTooltip was tried there first and didn't reliably resize) both
// already use — element-anchored here too, since each square is a static,
// individually hoverable/focusable target, same reasoning
// FunctionalModelText.vue gives for its own choice. Deliberately NOT
// TooltipView.vue/`store.hovered` itself: that type (`HoveredCard`) is a
// full `CardData` + produce/consume `GraphReason[]` link list — a shape
// this page's plain `{number,name,status,reasons}` entries don't have and
// shouldn't be forced into just to reuse one component.
const hoveredEntry = ref<CardStatusEntry | null>(null);
const tooltipEl = ref<HTMLElement | null>(null);
const tipX = ref(0);
const tipY = ref(0);
let positionRequestId = 0;

async function show(entry: CardStatusEntry, target: HTMLElement) {
  hoveredEntry.value = entry;
  const requestId = ++positionRequestId;
  await nextTick();
  if (!tooltipEl.value) return;
  const { x, y } = await computePosition(target, tooltipEl.value, {
    strategy: 'fixed',
    placement: 'top',
    middleware: [
      offset(8),
      flip(),
      shift({ padding: 8 }),
      size({
        padding: 8,
        apply({ availableHeight }) {
          tooltipEl.value!.style.maxHeight = `${availableHeight}px`;
        },
      }),
    ],
  });
  if (requestId !== positionRequestId) return; // superseded by a newer hover — discard
  tipX.value = x;
  tipY.value = y;
}
function hide() {
  hoveredEntry.value = null;
}
</script>

<template>
  <!-- `min-w-0` here is required, not defensive — this whole page's root is
       ITSELF a flex item of layouts/graph.vue's own outer row, and without
       an explicit override, a flex item's default `min-width: auto` is its
       content's min-content width; the 50-wide grid inside made that large
       enough that this root refused to shrink below it even after the
       INNER grid-content div (below) got its own `min-w-0` — confirmed live
       via Playwright (this root measured 1639px wide inside a 1400px
       viewport, pushing the peek panel 239px off-screen to the right,
       before adding this). Both `min-w-0`s are needed — one per flex
       container level the wide grid content passes through. -->
  <div class="relative flex min-h-0 min-w-0 flex-1">
    <!-- `min-w-0` is required (not just `min-h-0`) — this is a ROW flex
         item (see the parent's own `flex` with no `flex-col`), so its MAIN
         axis is width; without an explicit min-width override, a flex
         item's default `min-width: auto` is its content's own min-content
         width, which the 50-wide grid below (its own `overflow-x-auto`
         wrapper doesn't change THIS ancestor's min-content contribution)
         makes wide enough that the peek panel opening couldn't actually
         shrink this div past it — confirmed live via Playwright (grid
         wrapper stalled at ~1279px instead of the expected panel-width-
         reduced value, pushing the panel partly off-viewport). `min-w-0`
         is the standard fix: lets this item shrink to whatever space is
         actually left, and its own `overflow-y-auto`/the grid's own
         `overflow-x-auto` pick up the resulting overflow via scrolling
         instead. -->
    <div class="min-h-0 min-w-0 flex-1 overflow-y-auto p-6">
      <div class="mx-auto flex max-w-5xl flex-col gap-4">
        <div>
          <h1 class="text-sm font-semibold text-text">Fact-authoring status — {{ (statusFile?.set ?? SET).toUpperCase() }}</h1>
          <p class="mt-1 text-[11px] leading-relaxed text-muted">
            One square per card ({{ sortedCards.length }} total), colored by how far its functional-model facts have
            come along — see <code class="rounded bg-bg px-1 py-0.5">scripts/AI_FACT_ELIMINATION_PROCESS.md</code>.
            <template v-if="statusFile">
              Computed as of {{ new Date(statusFile.generatedAt).toLocaleString() }} — recomputed live on every load in
              dev; production serves the last-committed <code class="rounded bg-bg px-1 py-0.5">npm run card-status</code>
              snapshot.
            </template>
            Hover a square for details, click to preview the card. Row labels are position in the sorted list (1-50,
            51-100, ...), not literal collector numbers — this set's own numbering isn't contiguous (bonus/showcase
            variants run past 306).
          </p>
          <p v-if="statusPending && !statusFile" class="mt-2 text-[11px] text-muted">Loading…</p>
          <p v-if="statusError" class="mt-2 text-[11px] text-red-400">Failed to load card status: {{ statusError.message }}</p>
        </div>

        <div class="flex flex-wrap gap-x-4 gap-y-1.5 rounded-md border border-border-subtle bg-panel p-3">
          <div v-for="key in STATUS_ORDER" :key="key" class="flex items-center gap-1.5" :title="STATUS_META[key].description">
            <span class="h-3.5 w-3.5 shrink-0 rounded-sm" :style="{ background: STATUS_META[key].color }"></span>
            <span class="text-[11px] text-muted"><span class="font-semibold text-text">{{ STATUS_META[key].label }}</span> — {{ STATUS_META[key].description }}</span>
          </div>
        </div>
      </div>

      <!-- Fixed 50-per-row grid — left edge aligned with the text column
           above (same `mx-auto max-w-5xl`), so squares start exactly under
           the title/legend rather than being centered independently. Row
           labels live in their own absolutely-positioned column
           (`right-full`, out of flow, overshooting into the page's own
           left gutter) that does NOT scroll — only the squares themselves
           sit in the single `overflow-x-auto` container so the whole grid
           shares ONE scrollbar instead of one per row. Label row heights
           (`h-[18px]`) are matched to the square rows so the two columns
           stay vertically aligned despite being separate flex columns. -->
      <div class="relative mx-auto mt-4 max-w-5xl">
        <div class="absolute right-full mr-2 flex flex-col gap-2">
          <div
            v-for="row in rows"
            :key="row.start"
            class="flex h-[18px] w-12 shrink-0 items-center justify-end text-right text-[10px] tabular-nums text-muted"
          >
            {{ row.start }}-{{ row.end }}
          </div>
        </div>
        <div class="overflow-x-auto">
          <div class="flex w-max flex-col gap-2">
            <div v-for="row in rows" :key="row.start" class="flex h-[18px] items-center gap-2">
              <div v-for="(cluster, ci) in row.clusters" :key="ci" class="flex gap-[2px]">
                <button
                  v-for="entry in cluster"
                  :key="entry.number"
                  type="button"
                  class="h-[18px] w-[18px] shrink-0 rounded-[2px] outline-none transition-transform hover:z-10 hover:scale-125 focus-visible:z-10 focus-visible:scale-125 focus-visible:ring-2 focus-visible:ring-produce"
                  :class="{ 'status-square-selected z-10': isSelected(entry) }"
                  :style="{ background: STATUS_META[entry.status].color }"
                  :aria-label="`${entry.name} (#${entry.number}) — ${STATUS_META[entry.status].label}: ${entry.reasons.join(' ')}`"
                  @mouseenter="(e) => show(entry, e.currentTarget as HTMLElement)"
                  @mouseleave="hide"
                  @focus="(e) => show(entry, e.currentTarget as HTMLElement)"
                  @blur="hide"
                  @click="openCard(entry)"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- PRD 02 "Navigation" — mounted here too (alongside
         app/pages/app/index.vue, its original sole mount point); see
         CardPeekPanel.vue's own header comment for the updated list. Still
         never mounted on the card detail page's own route.
         2026-09-16: this page's own content wrapper above (`min-h-0 flex-1
         overflow-y-auto p-6`) was ALREADY a real flex sibling of this
         element, not layered under an absolutely-positioned overlay — so
         CardPeekPanel.vue's own overlay->layout rework (see its header
         comment) required no structural change here at all, just this
         comment update. Opening the panel now visibly shrinks the grid
         wrapper's own width (its `flex-1` yields real space to the panel);
         the grid stays fully reachable via that wrapper's own vertical
         scroll either way, never covered or cut off horizontally. -->
    <CardPeekPanel />

    <div
      ref="tooltipEl"
      class="fixed z-30 max-w-[320px] overflow-y-auto rounded-lg border border-border bg-panel p-2 text-xs transition-opacity duration-75"
      :class="{ 'pointer-events-none opacity-0': !hoveredEntry }"
      :style="{ left: `${tipX}px`, top: `${tipY}px`, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }"
    >
      <template v-if="hoveredEntry">
        <div class="mb-1 flex items-center gap-1.5">
          <span class="h-2.5 w-2.5 shrink-0 rounded-sm" :style="{ background: STATUS_META[hoveredEntry.status].color }"></span>
          <span class="font-semibold text-text">{{ hoveredEntry.name }}</span>
          <span class="text-[10px] text-muted">#{{ hoveredEntry.number }}</span>
        </div>
        <ul class="list-disc space-y-0.5 pl-4 text-muted">
          <li v-for="(reason, i) in hoveredEntry.reasons" :key="i">{{ reason }}</li>
        </ul>
      </template>
    </div>
  </div>
</template>

<style scoped>
/* Persistent "currently open in the peek panel" marker — reuses the SAME
   white double-drop-shadow glow `.search-match` (GraphCanvas.vue) already
   uses in the graph view itself for "this is the highlighted node," so a
   selected square reads via the app's existing visual language rather than
   inventing a new one. Kept as a plain CSS class (not a Tailwind ring/
   outline utility) specifically so it composes independently of the
   existing `hover:scale-125`/`focus-visible:ring-2` utilities already on
   this button — `filter` isn't a property either of those touch, so this
   stays visible unchanged through hover/focus and disappears cleanly the
   moment `isSelected` goes false (a different square clicked, or the panel
   closed). */
.status-square-selected {
  filter: drop-shadow(0 0 4px #ffffff) drop-shadow(0 0 4px #ffffff);
}
</style>
