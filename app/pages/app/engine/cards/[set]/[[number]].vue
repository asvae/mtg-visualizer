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
// **2026-09-18, later still: this is now THE ONE real card-detail page** —
// the old standalone `/app/card/[set]/[number].vue` route (a second,
// separately-maintained page wrapper around the exact same
// `CardDetailTabs.vue`) is gone; every real in-app link that used to point
// there (`RecognizerEntryCard.vue`, `SearchBox.vue`, `CardPeekPanel.vue`'s
// own "Open full card page" action, `GraphCanvas.vue`'s new-tab link,
// `CardDetailTabs.vue`'s own meld/other-face link) now points here instead.
// Two real capabilities that page's own chrome had, evaluated on the merge:
//   - **Previous/Next**: NOT reimplemented as separate chrome — this page's
//     existing sidebar (`EngineConsoleShell`'s own canPrev/canNext arrow-
//     key+click nav, the SAME pattern Predicates/Features already use)
//     already walks this exact set's own unique-card list
//     (`/api/card-status/:set`'s `cards` array is already one row per real
//     card name — FIN's own checked-in `data/fin/fin_scryfall.json` has zero
//     duplicate names, and the `fdn` branch below explicitly dedupes by name
//     too — so this is genuinely the same "adjacent real card" semantics the
//     old page's own `useSetOrder`-backed default path had, not a
//     downgrade), so nothing to port for a `fin`/`fdn` card. The one thing
//     that ISN'T ported: the old page's Previous/Next could additionally
//     scope itself to an ACTIVE GLOBAL graph filter (an imported deck's own
//     paste order, or a live Scryfall query's result list) — a genuinely
//     graph-page concept (`useGraphStore.ts`'s deck/query filter) with no
//     equivalent on this dev/engine console tab, which has its own unrelated
//     search+status-color filter instead; dropped, not silently — same
//     "doesn't apply here" call the deckQty badge below makes.
//   - **Deck-qty badge** (`getKnownDeckCards`/`getActiveFilterMode` from
//     `useGraphStore.ts`): DROPPED, not ported — this tab has no
//     deck-building concept at all (it's a fact-authoring/pipeline-status
//     dev console, not a graph-browsing view), so "copies in your imported
//     deck" has no meaning here. `useGraphStore.ts`'s own exports are left
//     untouched (that composable/its Deck concept is very much alive
//     elsewhere, e.g. the main graph page) — only this now-deleted page's
//     own USE of them is gone.
// A card whose `:set` ISN'T one of this tab's own tracked-corpus sets
// (`/api/card-status/sets`' answer — today just `fin`/`fdn`) but that a real
// link above still points at (any live `?sf=` Scryfall-query card, which can
// be from literally any real MTG set) is NOT force-redirected away — see
// `genericMode` below, the one genuinely new piece of logic this merge
// needed: skips the whole card-status sidebar/list machinery (there's no
// per-card status to show for a set this tab was never built to track) and
// falls back to a plain single-card view, Previous/Next restored via the
// SAME per-set `useSetOrder`/`neighborsInSetOrder` the old standalone page
// used for this exact case (that composable/its server route
// (`/api/cards/set-order/:set`) were already written generic-over-any-set,
// not FIN-specific, precisely for this "arbitrary live query set" path —
// confirmed by reading both before assuming they were safe to delete
// alongside the old page). The bare-`:set`-no-`:number` redirect-to-
// first-available-set behavior below is UNCHANGED for this case (a stale/
// typo'd set with no specific card requested is still a real "fix it for
// me" case, not a live-query card view).
//
// **FDN detail pane now mounts the SAME `CardDetailTabs.vue` FIN uses,
// 2026-09-18, later same day** (superseding the "deliberately MINIMAL, not
// CardDetailTabs.vue" scope decision this file's own header used to
// document here) — `GET /api/card/:set/:number` (`server/api/card/[set]/
// [number].ts`'s own `loadFdnFunctionalModel`) now has a real, explicit
// `fdn` branch serving that card's real `definition.ts` source (rendered
// via the same `FunctionalModelScript` FIN's own "Card Definition" tab
// already uses) plus its real authoring-pipeline status
// (`functional-model/pipeline-status.ts`), and `CardDetailTabs.vue` itself
// now has a matching `isFdn` branch: only "Scenarios" + "Card Definition"
// show (no Facts — an FDN card never gets a synergy.json at all, full
// stop), and the FIN-only Facts/Scenarios/Interactions review-status table
// is replaced by a real Confirm/"Reject…" block against the pipeline-status
// axis (`POST /api/fdn-cards/:slug/review`) — the ONE card-level review
// action an FDN card page has. See that component's own
// `isFdn` doc comment for the full design; nothing card-kind-specific is
// left to build in THIS file anymore — `selectedCardKey`/`cardData`/the
// `<CardDetailTabs>` mount below now work identically for either set.
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { onReviewStatusChanged } from '../../../../../composables/useReviewStatusBus';
import type { ReviewStatusChange } from '../../../../../composables/useReviewStatusBus';
import { useStatusFilterList } from '../../../../../composables/useStatusFilterList';
import type { StatusFilterOption } from '../../../../../composables/useStatusFilterList';
import { useSetOrder, neighborsInSetOrder, type SetOrderData } from '../../../../../composables/useSetOrder';
import type { CardResponse } from '../../../../../lib/cardResponse';
import type { CardStatusPageEntry } from '../../../../../../server/api/card-status/[set].get';
import { PIPELINE_STATUS_META } from '../../../../../lib/pipelineStatus';
import { statusBadgeStyle } from '../../../../../lib/badgeColor';

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

// The URL's own `:number` segment, if given — declared this early (rather
// than alongside the rest of the deep-linking block further down) because
// `genericMode` below (used by the `availableSets` redirect-guard watch,
// which runs `{ immediate: true }` at setup time) needs it in scope already.
const routeNumber = computed(() => (typeof route.params.number === 'string' ? route.params.number : undefined));

interface CardStatusFile {
  generatedAt: string;
  set: string;
  cards: CardStatusPageEntry[];
}

const ENGINE_SETS_LAST_SET_KEY = 'engine-sets-last-set';

const { data: availableSets } = useFetch<string[]>('/api/card-status/sets');
// A stale/typed-by-hand :set with no `:number` (bare set-picker visit) that
// no longer has real data falls back to the first real available set
// instead of silently 404ing/erroring forever. Does NOT fire when a
// `:number` IS given — that's `genericMode` below's own case (a real link
// to a specific card whose set was never meant to be one of THIS tab's
// tracked/selectable sets at all, e.g. any live `?sf=`-query card), which
// gets a real single-card fallback view instead of being redirected away.
//
// Also where "last viewed set" gets persisted (used to be an unconditional
// `onMounted`) — moved here and gated on `sets.includes(SET)` so a one-off
// `genericMode` visit (an arbitrary non-corpus set) never clobbers this with
// a set the bare `/app/engine/cards` index redirect couldn't usefully land
// on anyway.
watch(
  availableSets,
  (sets) => {
    if (!sets?.length) return;
    if (sets.includes(SET)) {
      if (typeof localStorage !== 'undefined') localStorage.setItem(ENGINE_SETS_LAST_SET_KEY, SET);
    } else if (!routeNumber.value) {
      navigateTo(`/app/engine/cards/${sets[0]}`, { replace: true });
    }
  },
  { immediate: true },
);
// True once we KNOW (availableSets resolved) this :set is genuinely outside
// this tab's own tracked corpus AND a specific card was asked for — false
// (not just "unknown yet") while availableSets is still in flight, so the
// normal corpus-mode UI renders first rather than flashing into generic mode
// speculatively. See this file's own header for the full rationale.
const genericMode = computed(() => !!availableSets.value && !availableSets.value.includes(SET) && !!routeNumber.value);

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
  { value: 'yellow', label: 'Rejected', color: '#eab308', description: 'A human reviewed this transcription and found it wrong — see its own review note.' },
  { value: 'green', label: 'Confirmed', color: '#22c55e', description: 'A human reviewed this transcription and confirmed it.' },
  {
    value: 're-review',
    label: 'Needs re-review',
    color: '#7dd3fc',
    description: 'A human previously confirmed this transcription, but its definition.ts has since changed — the old confirmation is stale and needs another look.',
  },
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

// --- FDN-only, page-local engine-support tri-state filter (2026-09-18) ---
// Deliberately NOT folded into `useStatusFilterList`/`STATUS_OPTIONS` above
// — that composable/`EngineConsoleStatusFilterControls.vue` stay single-axis
// on purpose (Keywords/Predicates/Sinks share them and have no such field at
// all). This is its own local ref + a further `.filter()` layered on top of
// `list.visible` (the search+color-filtered result), so it AND-combines with
// the existing color filter rather than replacing it. `CardStatusPageEntry
// .engineSupport` (`server/api/card-status/[set].get.ts`'s own fdn branch)
// is `undefined` for every `fin` entry and every `gray` fdn entry — 'all'
// (the default "–" state) intentionally includes those, matching this
// field's own real absent-vs-on/off semantics (see `pipeline-status.ts`'s
// own `PipelineStatusFile.engineSupport` doc comment).
type EngineSupportFilterValue = 'all' | 'on' | 'off';
const ENGINE_SUPPORT_FILTER_OPTIONS: { value: EngineSupportFilterValue; label: string; color: string; description: string }[] = [
  { value: 'all', label: '–', color: '#6b7280', description: 'Show every card regardless of the engine-support signal (includes cards with no signal at all — not yet gated, or fin).' },
  { value: 'on', label: 'On', color: '#22c55e', description: 'Only cards where nothing on the small known-engine-unsupported vocabulary list was touched (e.g. no Ward). Not a claim of full engine verification — just "nothing known-bad detected."' },
  { value: 'off', label: 'Off', color: '#eab308', description: 'Only cards that touch something on the small, deliberately-honest known-engine-unsupported vocabulary list (today: Ward — recognized/typed but not enforced by the real engine yet).' },
];
const engineSupportFilter = ref<EngineSupportFilterValue>('all');
const engineSupportFilteredEntries = computed<CardStatusPageEntry[]>(() =>
  engineSupportFilter.value === 'all'
    ? list.visible.value
    : list.visible.value.filter((e) => e.engineSupport === engineSupportFilter.value),
);
// Local prev/next/position-label derived off the further-narrowed list above
// (mirrors `useStatusFilterList`'s own `selectedIndex`/`canPrev`/`canNext`/
// `positionLabel` shape, but against `engineSupportFilteredEntries` instead
// of that composable's own internal `visible`) — for `fin`, or when the
// filter sits at 'all', `engineSupportFilteredEntries` is the SAME array
// reference as `list.visible.value`, so this is a no-op there, not a second
// divergent behavior.
const engineFilteredIndex = computed(() => engineSupportFilteredEntries.value.findIndex((e) => e.number === list.selectedKey.value));
const engineFilteredCanPrev = computed(() => engineFilteredIndex.value > 0);
const engineFilteredCanNext = computed(() => engineFilteredIndex.value >= 0 && engineFilteredIndex.value < engineSupportFilteredEntries.value.length - 1);
const engineFilteredPositionLabel = computed(() =>
  engineFilteredIndex.value >= 0 ? `${engineFilteredIndex.value + 1} of ${engineSupportFilteredEntries.value.length}` : '',
);
// Same "reselect the first visible entry when the current selection falls
// out of view" behavior `useStatusFilterList`'s own internal watch already
// gives `list.visible` — mirrored here for this further-narrowed list, since
// that internal watch has no knowledge of this page-local filter.
watch(engineSupportFilteredEntries, (entries) => {
  if (!entries.length) return;
  if (!entries.some((e) => e.number === list.selectedKey.value)) {
    list.selectedKey.value = entries[0]!.number;
  }
});

const selectedEntry = computed(() => list.selected.value);
function statusMeta(color: CardStatusPageEntry['color']) {
  return STATUS_OPTIONS.find((o) => o.value === color)!;
}

// Second, FDN-only nav-row swatch — engine-support signal, independent of
// (and always rendered alongside) the pipeline-status dot above. Same
// on/off colors as `ENGINE_SUPPORT_FILTER_OPTIONS` above, kept literal here
// rather than looked up by value since 'all' has no per-row meaning. A
// `gray`/never-gated entry (undefined `engineSupport`, the common case —
// 134/150 fdn cards as of writing) renders NEUTRAL (transparent fill, faint
// outline) rather than defaulting to a fabricated color — this is a real
// "not evaluated" state, not a false negative.
function engineSupportSwatchStyle(support: CardStatusPageEntry['engineSupport']) {
  if (support === 'on') return { background: '#22c55e' };
  if (support === 'off') return { background: '#eab308' };
  return { background: 'transparent', border: '1px solid rgba(148, 163, 184, 0.35)' };
}

// This card's own real name for the tab title — `selectedEntry` (the
// corpus-mode path) in the normal case, the directly-fetched `cardData`
// (below) in `genericMode`, where there IS no `selectedEntry` at all.
const displayName = computed(() => (genericMode.value ? cardData.value?.card.name : selectedEntry.value?.name));
useHead({ title: computed(() => (displayName.value ? `Engine | Cards | ${displayName.value}` : 'Engine | Cards')) });

// --- URL deep-linking (route <-> selection sync) for `:number` only — `:set`
// itself never changes without a full remount, see this file's own header.
// (`routeNumber` itself is declared up top, near `genericMode` — see that
// declaration's own comment for why.)
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
  const idx = engineFilteredIndex.value;
  if (idx > 0) pickEntry(engineSupportFilteredEntries.value[idx - 1]!);
}
function goNext() {
  const idx = engineFilteredIndex.value;
  if (idx >= 0 && idx < engineSupportFilteredEntries.value.length - 1) pickEntry(engineSupportFilteredEntries.value[idx + 1]!);
}

// --- `genericMode` only: Previous/Next via this set's own real per-set
// order (`useSetOrder`/`neighborsInSetOrder` — see this file's own header
// for why this is the same mechanism the old standalone page used for this
// exact "not one of this tab's tracked corpus sets" case, not a new one
// invented for this merge). Fetched lazily — only once `genericMode` is
// actually true, never for the (overwhelmingly common) corpus-mode path.
const { getSetOrder } = useSetOrder();
const genericSetOrder = ref<SetOrderData>({ collectorNumbers: [], representativeByNumber: {} });
const genericSetOrderLoaded = ref(false);
watch(
  genericMode,
  async (isGeneric) => {
    if (!isGeneric || genericSetOrderLoaded.value) return;
    genericSetOrder.value = await getSetOrder(SET);
    genericSetOrderLoaded.value = true;
  },
  { immediate: true },
);
const genericNeighbors = computed(() =>
  routeNumber.value ? neighborsInSetOrder(genericSetOrder.value, routeNumber.value) : { prev: null, next: null },
);
function goGenericPrev() {
  if (genericNeighbors.value.prev) navigateTo(`/app/engine/cards/${SET}/${encodeURIComponent(genericNeighbors.value.prev)}`);
}
function goGenericNext() {
  if (genericNeighbors.value.next) navigateTo(`/app/engine/cards/${SET}/${encodeURIComponent(genericNeighbors.value.next)}`);
}

// --- Detail pane: real card content inline, via `CardDetailTabs.vue` (the
// shared component `CardPeekPanel.vue` also mounts) — works identically for
// `fin` and `fdn` now (2026-09-18, later same day: `GET /api/card/:set/
// :number` grew a real `fdn` branch, see this file's own header) — no more
// `IS_FDN` gating here.
const responseCache = new Map<string, CardResponse>();
const cardData = ref<CardResponse | null>(null);
const cardLoading = ref(false);
const cardNotFound = ref(false);

// Keyed off `routeNumber` directly in `genericMode` (there's no
// `selectedEntry` at all in that mode — no card-status list to select
// from), off `selectedEntry`'s own number otherwise — see this file's own
// header for the full `genericMode` rationale.
const activeNumber = computed(() => (genericMode.value ? routeNumber.value ?? null : selectedEntry.value?.number ?? null));
const selectedCardKey = computed(() => (activeNumber.value ? `${SET}/${activeNumber.value}` : null));

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

// FDN detail pane used to fetch its own minimal `definition.ts` source
// directly via `GET /api/engine-status/source` (Features'/Predicates' own
// source-citation route) — retired 2026-09-18, later same day, now that
// `CardDetailTabs`/its own `GET /api/card/:set/:number` fetch above serves
// the exact same source (plus real pipeline-status + Confirm/Reject) as
// part of the SAME request every card on this tab already makes; no
// second source-fetch mechanism needed.

// --- Pipeline-status badge, `EngineConsoleShell`'s `header-extra` slot
// (2026-09-18, later still) — moved here from a bordered box
// `CardDetailTabs.vue` used to render next to `CardMedia` (explicit user
// call: "Move it to the header (near N of N) and just use badge. I don't
// need this text"). Computed independently off `cardData` here rather than
// reading it back out of `CardDetailTabs.vue` (which owns no header/slot
// concept of its own to reach upward through) — same "display metadata
// computed fresh at each real consumer" posture `PIPELINE_STATUS_META`
// itself already documents as its own reason for existing as a standalone
// module. `IS_FDN`-only: FIN cards on this same tab have a different
// review-status concept entirely (the fact-authoring status square next to
// the Facts tab label inside `CardDetailTabs.vue`, unrelated to this axis),
// not a pipeline-status badge. `genericMode` (a live-query card whose `:set`
// isn't tracked here at all) is implicitly excluded too — `IS_FDN` can only
// ever be true for the real, tracked `fdn` corpus.
const pipelineHeaderBadge = computed(() => {
  if (!IS_FDN || !cardData.value) return null;
  const status = cardData.value.functionalModel?.pipelineStatus?.status ?? 'gray';
  return PIPELINE_STATUS_META[status];
});

// Second, page-local header badge — the selected card's own real
// `pipeline-status.json` `engineSupport` (`PipelineStatusFile.engineSupport`,
// see `functional-model/pipeline-status.ts`'s own doc comment), only ever
// present at all on a gated (`purple`/`blue`) fdn entry — `null` here for a
// `gray` card (nothing evaluated yet, no field to show) same as for `fin`/
// `genericMode`, mirroring `pipelineHeaderBadge`'s own guard shape.
const engineSupportHeaderBadge = computed(() => {
  if (!IS_FDN || !cardData.value) return null;
  const engineSupport = cardData.value.functionalModel?.pipelineStatus?.engineSupport;
  if (!engineSupport) return null;
  return engineSupport === 'on'
    ? { label: 'Engine OK', color: '#22c55e', title: 'Nothing on the known-engine-unsupported vocabulary list was touched by this card (not a claim of full engine verification).' }
    : { label: 'Engine gap', color: '#eab308', title: 'This card touches something on the small, known-engine-unsupported vocabulary list (e.g. Ward — recognized/typed but not enforced by the real engine yet).' };
});
</script>

<template>
  <EngineConsoleShell
    :pending="genericMode ? cardLoading && !cardData : statusPending && !statusFile"
    :error="genericMode ? null : statusError"
    :can-prev="genericMode ? !!genericNeighbors.prev : engineFilteredCanPrev"
    :can-next="genericMode ? !!genericNeighbors.next : engineFilteredCanNext"
    :position-label="genericMode ? (activeNumber ? `#${activeNumber}` : '') : engineFilteredPositionLabel"
    @prev="genericMode ? goGenericPrev() : goPrev()"
    @next="genericMode ? goGenericNext() : goNext()"
  >
    <template v-if="pipelineHeaderBadge" #header-extra>
      <UBadge class="shrink-0" :style="statusBadgeStyle(pipelineHeaderBadge.color)" size="sm" variant="solid">{{ pipelineHeaderBadge.label }}</UBadge>
      <UBadge
        v-if="engineSupportHeaderBadge"
        class="min-w-0 shrink-0"
        :style="statusBadgeStyle(engineSupportHeaderBadge.color)"
        :title="engineSupportHeaderBadge.title"
        size="sm"
        variant="solid"
      >{{ engineSupportHeaderBadge.label }}</UBadge>
    </template>

    <template #nav>
      <template v-if="genericMode">
        <!-- This card's `:set` isn't one of this tab's own tracked-corpus
             sets (today just fin/fdn) — no card-status list to show, so no
             search/filter/list here at all, just a real single-card view in
             the detail pane (see this file's own header for the full
             rationale) with Previous/Next still walking this set's own real
             per-set order. -->
        <div class="mb-1 px-1.5 text-sm font-semibold text-text">{{ SET.toUpperCase() }} · standalone card</div>
        <p class="mb-3 px-1.5 text-[11px] leading-relaxed text-muted">
          Not one of this tab's own tracked sets ({{ (availableSets ?? []).map((s) => s.toUpperCase()).join('/') || '…' }}) —
          showing this one card standalone. Previous/Next still walks {{ SET.toUpperCase() }}'s own real collector-number
          order.
        </p>
        <NuxtLink to="/app/engine/cards" class="px-1.5 text-[11px] text-text underline">&larr; Browse the Cards tab</NuxtLink>
      </template>
      <template v-else>
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
          :visible-count="engineSupportFilteredEntries.length"
          :total-count="rawCards.length"
          @update:search-query="(v: string) => (list.searchQuery.value = v)"
          @toggle="list.toggleFilter"
        >
          <template #help>
            <EngineConsoleStatusHelp :status-options="STATUS_OPTIONS" />
          </template>
        </EngineConsoleStatusFilterControls>

        <!-- Page-local, FDN-only engine-support tri-state filter — see this
             file's own `engineSupportFilter`/`engineSupportFilteredEntries`
             doc comments. Same compact chip-row visual language as
             `EngineConsoleStatusFilterControls.vue` above (reused directly,
             not imported from it — that component stays single-axis). -->
        <div v-if="IS_FDN" class="mb-3 flex flex-col gap-0.5">
          <div class="mb-1 px-1.5 text-[11px] font-semibold tracking-wide text-muted uppercase">Engine support</div>
          <div class="flex items-center gap-1 px-1.5">
            <button
              v-for="opt in ENGINE_SUPPORT_FILTER_OPTIONS"
              :key="opt.value"
              type="button"
              class="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-left"
              :class="engineSupportFilter === opt.value ? 'text-text' : 'text-muted opacity-40'"
              :title="opt.description"
              @click="engineSupportFilter = opt.value"
            >
              <span class="h-2.5 w-2.5 shrink-0 rounded-sm" :style="{ background: opt.color }"></span>
              <span class="truncate text-[11px]">{{ opt.label }}</span>
            </button>
          </div>
        </div>

        <EngineConsoleEntryListPanel
          :entries="engineSupportFilteredEntries"
          :key-of="(e: CardStatusPageEntry) => e.number"
          :selected-key="list.selectedKey.value"
          empty-message="No cards match the current search/filters."
          @select="pickEntry"
        >
          <template #row="{ entry }">
            <span class="flex shrink-0 items-center gap-1">
              <span class="h-[9px] w-[9px] shrink-0 rounded-full" :style="{ background: statusMeta(entry.color).color }" />
              <span
                v-if="IS_FDN"
                class="h-1.5 w-1.5 shrink-0 rounded-full"
                :style="engineSupportSwatchStyle(entry.engineSupport)"
              />
            </span>
            <span class="shrink-0 text-[10px] tabular-nums text-muted/70">#{{ entry.number }}</span>
            <span class="truncate">{{ entry.name }}</span>
          </template>
        </EngineConsoleEntryListPanel>
      </template>
    </template>

    <template #detail>
      <!-- Real full card content inline, via `CardDetailTabs.vue` — same
           component for `fin` and `fdn` (2026-09-18, later same day, see
           this file's own header); that component's own `isFdn` branch
           renders FDN's genuinely different content (no Facts tab — an FDN
           card never gets a synergy.json — but Scenarios/Card Definition
           stay; a pipeline-status Confirm/Reject block instead of the
           FIN-only review table). Also the one card page ANY real in-app
           link (search, graph nodes, the peek panel, recognizer match
           lists) now points to — including `genericMode`, a card whose own
           `:set` isn't tracked by this tab's sidebar at all. -->
      <template v-if="genericMode || selectedEntry">
        <CardImageSkeleton v-if="cardLoading && !cardData" />
        <p v-else-if="cardNotFound" class="text-xs text-muted italic">Card not found.</p>
        <CardDetailTabs v-else-if="cardData" :data="cardData" :set="SET" :number="activeNumber!" />
      </template>
      <p v-else class="text-xs text-muted italic">Pick a card from the sidebar.</p>
    </template>
  </EngineConsoleShell>
</template>
