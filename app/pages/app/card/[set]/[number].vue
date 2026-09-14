<script setup lang="ts">
import { computed, inject, onMounted, onUnmounted, ref, watch } from 'vue';
import { describeRelation, groupChipsByVerb } from '../../../../lib/relations';
import { factConditions, isSelfReferencing } from '../../../../lib/factConditions';
import { orderByTextPosition } from '../../../../lib/factOrder';
import type { FactRow } from '../../../../lib/factOrder';
import { describeFact } from '../../../../../functional-model/synergy';
import type { Fact } from '../../../../../functional-model/synergy';
import { TYPE_DERIVED_RECOGNIZER_IDS } from '../../../../../functional-model/recognizers/types';
import type { EnrichedInteractionGroup, ContinuousKeywordGrant } from '../../../../../server/api/card/[set]/[number]';
import type { CardData, EdgeData, ThemeData, AnnotatedCard, ReviewStatus } from '../../../../types';
import type { LogEntry, Scenario } from '../../../../../functional-model/harness';
import { getKnownDeckCards, getActiveFilterMode, StoreKey } from '../../../../composables/useGraphStore';
import { useSetOrder, neighborsInSetOrder, type SetOrderData } from '../../../../composables/useSetOrder';

definePageMeta({ layout: 'graph' });

// Debug column showing each row's raw `Fact` JSON, so it's inspectable
// without switching to the separate JSON tab or opening devtools. On by
// default (standing debug aid, not a one-off) — flip to false to hide it
// without deleting anything.
const SHOW_FACT_DEBUG_COLUMN = true;

const route = useRoute();
const store = inject(StoreKey)!;

interface CardResponse {
  card: CardData;
  edges: EdgeData[];
  themes: ThemeData[];
  functionalModel: {
    source: string;
    synergy: { source: Fact[]; sink: Fact[] } | null;
    traces: {
      scenario: { setup: string; action: string; result: string; raw: Scenario };
      log: LogEntry[];
      actions?: { label: string; from: number }[];
    }[];
    annotatedCard: AnnotatedCard | null;
    review: 'ai' | 'human' | null;
    scenariosReview: 'draft' | 'reviewed';
    interactionsReview: 'draft' | 'reviewed';
    continuousKeywordGrants: { front?: ContinuousKeywordGrant[]; back?: ContinuousKeywordGrant[] } | null;
  } | null;
  interactions: EnrichedInteractionGroup[];
}

// The URL's raw :number segment, parsed for the old plain-±1 fallback only
// (see setOrderLoaded's own comment below for when that fallback still
// applies) — the real default Previous/Next path now walks setOrder's own
// per-set unique-card list instead of doing arithmetic on this.
const currentNumber = computed(() => parseInt(String(route.params.number), 10));

// Per-set "mechanically unique" collector-number list (see
// app/composables/useSetOrder.ts and server/api/cards/set-order/[set].ts's
// own header for what "mechanically unique" means and why plain ±1 on
// :number is wrong for a set like FIN, which reuses collector numbers
// 300+/400+/500+ for booster-fun/showcase/extended-art/surgefoil
// re-treatments of the SAME card) — fetched once per set code, reused
// across every Previous/Next click within that set (the composable's own
// module-scope cache, not a local one here, is what makes that true across
// this whole tab, not just this one component instance). Refetches (from
// cache, so effectively free after the first time) whenever :set itself
// changes, which only happens on a direct cross-set URL visit — normal
// within-set Previous/Next browsing never changes :set.
const { getSetOrder } = useSetOrder();
const setOrder = ref<SetOrderData>({ collectorNumbers: [], representativeByNumber: {} });
// True once the fetch above has SETTLED (success or failure/empty) for the
// set currently on screen — distinguishes "still loading, don't show a
// target that's about to change out from under the user" (Previous/Next
// render disabled, same look as either edge of the set) from "genuinely
// came back empty" (network hiccup, or a set this route can't resolve at
// all), which falls back to the old plain ±1 arithmetic as a safety net
// rather than leaving Previous/Next permanently dead.
const setOrderLoaded = ref(false);
watch(
  () => String(route.params.set),
  async (set) => {
    setOrderLoaded.value = false;
    setOrder.value = await getSetOrder(set);
    setOrderLoaded.value = true;
  },
  { immediate: true }
);
// This card's own nearest unique-card neighbors within setOrder — see
// neighborsInSetOrder's own doc comment for how a bonus/variant number (not
// itself a list entry) is handled the same as one that is.
const setNeighbors = computed(() => neighborsInSetOrder(setOrder.value, String(route.params.number)));

interface FilterCardEntry {
  name: string;
  set: string;
  collectorNumber: string;
}
// Whichever global filter (deck import / Scryfall query) is active right
// now, resolved to a real, ordered {set, collectorNumber} list — fetched
// once on mount, same "standalone route" reasoning as the main useFetch
// above (this page doesn't share the main graph store's already-loaded
// card list, see this file's own header comment). `null` while unresolved
// OR when no filter is active at all — either way Previous/Next below fall
// back to plain ±1 in the SAME real set the current card is in.
const filterOrder = ref<FilterCardEntry[] | null>(null);

async function loadFilterOrder() {
  const filter = getActiveFilterMode();
  if (!filter) return;
  try {
    let raw: { name: string; set?: string; collector_number?: string; card_faces?: { name?: string }[] }[];
    if (filter.mode === 'deck') {
      const res = await fetch('/api/cards/by-names', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names: [...new Set(filter.cards.map((c) => c.name))] }),
      });
      const body = await res.json();
      if (!res.ok) return;
      raw = body.cards;
    } else {
      const res = await fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: filter.query }),
      });
      const body = await res.json();
      if (!res.ok) return;
      raw = body.cards;
    }
    // Keyed by every name a decklist/query might reference a card by — its
    // own top-level name (a DFC's is both faces joined by " // ") AND each
    // individual face's name, same front-face fallback deckQty above uses.
    const byName = new Map<string, FilterCardEntry>();
    for (const c of raw) {
      if (!c.set || !c.collector_number) continue;
      const entry: FilterCardEntry = { name: c.name, set: c.set, collectorNumber: c.collector_number };
      byName.set(c.name, entry);
      for (const f of c.card_faces ?? []) if (f.name) byName.set(f.name, entry);
    }
    const seen = new Set<string>();
    const dedupe = (e: FilterCardEntry) => {
      const key = `${e.set}/${e.collectorNumber}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    };
    if (filter.mode === 'deck') {
      // Preserve the deck's own paste order — the whole point of scoping to
      // a deck is browsing it as a deck, not by incidental collector number.
      filterOrder.value = filter.cards.map((c) => byName.get(c.name)).filter((e): e is FilterCardEntry => !!e && dedupe(e));
    } else {
      // No "paste order" to preserve here — collector number within each
      // real set is the closest thing to a stable, sensible reading order.
      filterOrder.value = [...byName.values()]
        .filter(dedupe)
        .sort((a, b) => (a.set === b.set ? Number(a.collectorNumber) - Number(b.collectorNumber) : a.set.localeCompare(b.set)));
    }
  } catch {
    // network hiccup — Previous/Next just fall back to plain ±1 below
  }
}

// Current card's position in the active filter's own ordered list, if any —
// -1 (not just "no filter") also covers the current card genuinely not
// being IN that list (e.g. a stale filter flag, or a direct visit to some
// other card while a deck/query filter happens to be active elsewhere);
// either way that's exactly when falling back to plain ±1 is right, same as
// no filter at all.
const filterIndex = computed(() => {
  if (!filterOrder.value || !card.value) return -1;
  return filterOrder.value.findIndex((e) => e.set === card.value!.set && e.collectorNumber === card.value!.collectorNumber);
});

interface NeighborTarget {
  set: string;
  collectorNumber: string;
}
// No-filter default path, below: walks setOrder's own unique-card list via
// setNeighbors whenever it's available (setOrder.value.length — the common
// case once the one-time per-set fetch settles), falling back to the old
// plain ±1 arithmetic only if that fetch genuinely came back empty
// (setOrderLoaded true, setOrder still `[]` — a network hiccup, or a set
// this route can't resolve at all). While the fetch is still in flight
// (setOrderLoaded false) Previous/Next render disabled — same look as
// either edge of the set — rather than showing a plain-±1 target that would
// visibly change out from under the user the instant the real list lands.
const prevTarget = computed<NeighborTarget | null>(() => {
  if (filterIndex.value >= 0) return filterIndex.value > 0 ? filterOrder.value![filterIndex.value - 1]! : null;
  if (setOrder.value.collectorNumbers.length) return setNeighbors.value.prev ? { set: String(route.params.set), collectorNumber: setNeighbors.value.prev } : null;
  if (!setOrderLoaded.value) return null;
  return Number.isFinite(currentNumber.value) && currentNumber.value > 1
    ? { set: String(route.params.set), collectorNumber: String(currentNumber.value - 1) }
    : null;
});
const nextTarget = computed<NeighborTarget | null>(() => {
  if (filterIndex.value >= 0) return filterIndex.value < filterOrder.value!.length - 1 ? filterOrder.value![filterIndex.value + 1]! : null;
  if (setOrder.value.collectorNumbers.length) return setNeighbors.value.next ? { set: String(route.params.set), collectorNumber: setNeighbors.value.next } : null;
  if (!setOrderLoaded.value) return null;
  return Number.isFinite(currentNumber.value) ? { set: String(route.params.set), collectorNumber: String(currentNumber.value + 1) } : null;
});

// Same names filterOrder above already resolved (deck paste order or query
// match — either way `filterOrder` entries carry their own `name`), reused
// here as the main fetch's own POST body so the Interactions panel
// (server/api/card/[set]/[number].ts's `filterNames` scoping) respects the
// same active global filter Previous/Next does — `null` until filterOrder
// itself settles (or forever, if no filter is active), same "unscoped
// until proven otherwise" fallback.
const filterNames = computed<string[] | null>(() => (filterOrder.value ? filterOrder.value.map((e) => e.name) : null));

// Standalone request — this page owns its data, independent of the big
// client-side graph store (app/composables/useGraphStore.ts). A direct visit
// (bookmark, shared link) renders without needing the whole graph loaded first.
// URL as a getter (not a plain string) so clicking Previous/Next — which
// changes the route params on the same route instance — re-fetches instead of
// only fetching once at first mount. Routed by set/collector-number (same URL
// shape as scryfall.com/card/<set>/<number>) rather than the Scryfall id, so
// prev/next is a plain ±1 on the number segment.
// Not awaited: this route is ssr:false (client-only) anyway, and awaiting
// would suspend this component's own render until the fetch resolves —
// meaning `pending` is already false by the time anything renders, so the
// spinner below never shows on a fresh visit (only for a genuine
// Previous/Next navigation — see hasLoadedCard below for why the OTHER
// reactive refetch this same call can trigger, filterNames settling, no
// longer shows it too).
// POST (not GET) so `filterNames` can ride along in the body — a reactive
// getter, same as the URL above, so this automatically refetches once
// filterOrder (and therefore filterNames) settles after mount, picking up
// the Interactions panel's filter scoping without a second request.
const { data, pending, error } = useFetch<CardResponse>(() => `/api/card/${route.params.set}/${route.params.number}`, {
  method: 'POST',
  body: computed(() => (filterNames.value ? { filterNames: filterNames.value } : undefined)),
});

// Real full-screen spinner only for the very first fetch of whichever card
// is currently on screen — the automatic refetch above (once filterNames
// settles a moment after mount) flips `pending` true again for an instant,
// which used to blank the whole page back to the spinner and right back
// (a visible flash) even though `data` itself never actually goes stale —
// useFetch keeps the previous response on screen until the new one lands.
// Reset per-card (not just once ever) so a genuine Previous/Next navigation
// still shows the spinner for ITS first fetch.
const hasLoadedCard = ref(false);
watch(data, (v) => {
  if (v) hasLoadedCard.value = true;
});
watch(() => route.params.number, () => {
  hasLoadedCard.value = false;
});

const card = computed(() => data.value?.card ?? null);

// Known-deck qty for the card currently on screen — shows regardless of
// whether that deck is also the active global filter (see
// getKnownDeckCards's own comment in useGraphStore.ts and the "Global
// filter by deck" checkbox in AppHeader.vue), same as the main graph's own
// node badge. Reads straight from localStorage (not the server response —
// the card route doesn't carry qty, the client already has the parsed deck
// in hand), so this stays in sync with whatever deck the user last pasted
// without a round-trip.
const deckQty = computed(() => {
  if (!card.value) return null;
  const deck = getKnownDeckCards();
  if (!deck) return null;
  // Scryfall's own top-level `name` on a DFC is both faces joined by " // "
  // (that's exactly what card.value.name is here — this route hands back
  // the raw Scryfall field, no card_faces breakdown) but a decklist almost
  // always names just the front face. Same fallback useGraphStore.ts's own
  // deck-mode merge uses against card_faces[].name, just matched the other
  // direction here since this route has no faces array to check — a front
  // face name is a real prefix of the combined name, followed by " // ".
  const exact = deck.find((c) => c.name === card.value!.name);
  if (exact) return exact.qty;
  const frontFace = deck.find((c) => card.value!.name.startsWith(`${c.name} // `));
  return frontFace?.qty ?? null;
});

// functional-model's own outline data — the card's v2 (SYNERGY_DESIGN.md)
// AI-authored, execution-verified attribute-bag facts
// (functional-model/cards/<slug>/synergy.json). `null` for a card not yet
// migrated to v2 (see synergy.value).
const synergy = computed(() => data.value?.functionalModel?.synergy ?? null);
// Flattened for display — the underlying synergy.json/Fact[] split into
// `source`/`sink` arrays is a real structural distinction for the matcher
// (functional-model/synergy.ts), but each Fact already carries its own
// `role` field, so showing that split as two top-level JSON keys here is
// redundant, not informative — one array, same order the Facts tab's own
// table already uses (sink then source), is the more honest "what does one
// fact actually look like" view.
// A single Facts-tab row's debug cell shows only a compact single-line JSON
// summary inline (see factDebugJson below) — click opens the full
// pretty-printed fact JSON in this modal instead of relying on a native
// title-attribute hover tooltip, which stays exactly as hard to read as the
// inline text itself. (The JSON tab itself renders its own full JSON
// directly inline via JsonHighlight now — no modal indirection there, this
// modal is Facts-debug-cell-only.) `debugModalOpen`/`debugModalTitle`/
// `debugModalContent` follow AppHeader.vue's own `UModal v-model:open`
// convention. The modal itself is header-less (no `title` prop,
// `:close="false"`) so the JSON content is the sole visible thing, but a
// normal centered/sized box — NOT `fullscreen` (tried once, was too much
// per explicit correction) — `:ui="{ content: 'max-w-3xl' }"` caps its
// width the same way the very first (pre-fullscreen) version of this modal
// did. `debugModalTitle` is kept (write-only now) for a future
// accessible-name/breadcrumb use, not read by the template.
const debugModalOpen = ref(false);
const debugModalTitle = ref('');
const debugModalContent = ref('');
function openDebugModal(title: string, content: string) {
  debugModalTitle.value = title;
  debugModalContent.value = content;
  debugModalOpen.value = true;
}
const functionalModelJson = computed(() => (synergy.value ? JSON.stringify([...synergy.value.sink, ...synergy.value.source], null, 2) : null));
const cardJson = computed(() => (data.value?.functionalModel?.annotatedCard ? JSON.stringify(data.value.functionalModel.annotatedCard, null, 2) : null));

// `factConditions` itself now lives in app/lib/factConditions.ts (extracted
// for real unit coverage — see that file's own header for why, and its
// sibling factConditions.test.ts) — imported above, not defined here.

// Same formula as FunctionalModelText.vue's own `factKey`, mirroring
// engine's own `factIdentity()` (functional-model/synergy.ts) — matches a
// table row's raw `Fact` to the fact(s) behind a linked phrase there, so
// hovering a row can highlight its own phrase in the annotated text.
// `Fact.id` was removed 2026-09-11; identity is now role + rendered label +
// the fact's own first real `annotations` entry (stringified). `annotations`
// is required by the TYPE, but only summon-bahamut's on-disk synergy.json
// actually carries it so far (pool-wide migration is separate, later work)
// — every other card's real facts lack the field despite the type, so this
// must tolerate `undefined` at runtime (confirmed live 500s otherwise,
// 2026-09-11).
function factKey(fact: Fact): string {
  return `${fact.role}::${describeFact(fact)}::${JSON.stringify(fact.annotations?.[0])}`;
}
const hoveredFactKey = ref<string | null>(null);

// Parser-derived facts (`Fact.provenance?.origin === 'parser'` —
// functional-model/PRD_AUTOMATED_AUTHORING.md, see .claude/contracts/
// card-schema.md's "Parser-derived facts" section) are boilerplate an agent
// didn't have to author by hand (e.g. "this permanent enters the
// battlefield normally" on nearly every permanent) — real, correct facts,
// just not ones a reviewer needs to see by default. Default OFF so the
// normal per-card Facts view stays exactly as uncluttered as before this
// wiring landed; toggling shows them inline in the SAME text-ordered list
// (never a separate section — `feedback_facts_text_order_role_icon_only`),
// with a small provenance badge per row (see the Facts tab template).
// Lives on the shared store now (survives navigating away and back, and
// persists to localStorage — same treatment as store.functionalModelTab
// just below), not a local ref — see useGraphStore.ts's own comment on
// showParserFacts for why.
const showParserFacts = store.showParserFacts;
function isParserFact(fact: Fact): boolean {
  return fact.provenance?.origin === 'parser';
}

// Sibling toggle (2026-09-14) — "type-derived" facts, a strict SUBSET of
// parser-derived ones whose entire match is structurally implied by the
// card's own printed type/supertype alone (today's real pool: a Saga's
// lore-counter/sacrifice/dies facts — every Saga gets essentially the same
// mechanically-predictable facts, reviewing them per-card is repetitive
// busywork). Classification lives in `functional-model/recognizers/
// types.ts`'s own `TYPE_DERIVED_RECOGNIZER_IDS` (shared with the
// recognizer-coverage page's own identical checkbox,
// `server/api/recognizers/index.get.ts` + `RecognizerEntryCard.vue` — see
// that constant's own doc comment for the full "which recognizers qualify"
// reasoning, not re-derived here) — checked directly against this fact's own
// `provenance.rule` rather than a server-annotated flag, since `provenance`
// is already served per fact (same data the parser-derived toggle above
// already reads). Independent of `showParserFacts`: a fact can be
// type-derived AND parser-derived (true for every real Saga fact today),
// so a row's own visibility is gated by BOTH toggles' current states (see
// `factRowGroups` below), never just one implying the other.
const showTypeDerivedFacts = store.showTypeDerivedFacts;
function isTypeDerivedFact(fact: Fact): boolean {
  return !!fact.provenance?.rule && TYPE_DERIVED_RECOGNIZER_IDS.has(fact.provenance.rule);
}

// Third sibling toggle (2026-09-14) — "AI" facts, the exact complement of
// `isParserFact` (no `Fact.provenance` at all — hand-authored, never run
// through a recognizer). Default ON (see useGraphStore.ts's own comment on
// showAiFacts) so a fresh viewer sees no change from before this toggle
// existed. Same AND-gated combination as the other two in `factRowGroups`
// below, not a separate section.
const showAiFacts = store.showAiFacts;
function isAiFact(fact: Fact): boolean {
  return !isParserFact(fact);
}

// Recognizer-source lookup for a parser fact's own provenance popover used
// to live here — removed 2026-09-13 when the Facts-tab wand-sparkles icon
// (see the template below) was inverted to mark agent/AI-authored facts
// instead of parser-derived ones. Reintroduced the same day, same-day
// follow-up, as its own dedicated button in the debug column instead of a
// hover popover on the role icon — see `openRecognizerSourceModal` below
// (near `openFactDebugModal`) and the debug-column template.

// `describeFact()` (functional-model/synergy.ts, engine-owned) always
// returns its label lowercase. Capitalizing via CSS `::first-letter` on the
// label cell is fragile: it only targets the first TEXT NODE, so rows whose
// label is preceded by the "linked to card text" icon (a sibling element,
// not part of the text node) silently don't get capitalized. Capitalize the
// string itself instead, uniformly, regardless of what markup precedes it.
function factLabel(fact: Fact): string {
  const text = describeFact(fact);
  return text.length ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

// Every fact now links to something real — a body oracle-text span
// (isFactAnnotated) or, failing that, the header name (isHeaderLinkedFact) —
// so a dedicated icon glyph no longer distinguishes anything (it was on
// every row). The underlying link behavior is unchanged, just moved onto the
// row's own label span instead of a separate icon element: a body-linked
// label's hover-highlight already comes free from the row's own
// hoveredFactKey handlers on <tr> (unchanged, see the template); a
// header-linked label additionally flashes the header name on hover and
// scrolls to it + pops its tooltip on click, via the three helpers below.
function factLinkTitle(fact: Fact): string | undefined {
  if (isFactAnnotated(fact)) return 'Linked to card text';
  if (isHeaderLinkedFact(fact)) return 'Linked to the card name above — click to jump to it';
  return undefined;
}
function onFactLabelEnter(fact: Fact) {
  if (isHeaderLinkedFact(fact)) headerHighlightIndex.value = factFaceIndex(fact);
}
function onFactLabelLeave(fact: Fact) {
  if (isHeaderLinkedFact(fact)) headerHighlightIndex.value = null;
}
function onFactLabelClick(fact: Fact) {
  if (isHeaderLinkedFact(fact)) scrollToHeaderName(factFaceIndex(fact));
}

// Debug column: a small icon button only (no raw JSON text rendered in the
// cell itself) — click opens the full pretty-printed JSON in the shared
// debug modal (see `openDebugModal` above).
function factDebugJsonPretty(fact: Fact): string {
  return JSON.stringify(fact, null, 2);
}
function openFactDebugModal(fact: Fact) {
  openDebugModal(`Fact JSON — ${factKey(fact)}`, factDebugJsonPretty(fact));
}

// Recognizer-source modal for a parser-derived fact's own provenance — a
// dedicated third debug-column button (`isParserFact(row.fact)` gates it in
// the template, so it only ever renders for a fact that actually names a
// `provenance.rule`), separate from the plain JSON modal above and from the
// role column's own `wand-sparkles` icon (which marks the OPPOSITE case, an
// agent-authored fact with no rule to show at all — the two never appear on
// the same row). Fetches the recognizer's real TypeScript source from
// `GET /api/recognizer-source/:rule` (server/api/recognizer-source/
// [rule].get.ts, allowlist-gated) and renders it via `FunctionalModelScript`
// — same highlighter the card's own Script tab already uses below. Cached
// per-rule in a plain module-scope-adjacent `Map` (not a `ref`, since the
// cache itself never needs to be reactive — only the currently-displayed
// code/error/loading refs below do) so re-opening the same rule's modal
// within this page's lifetime never re-fetches.
const recognizerSourceCache = new Map<string, string>();
const recognizerSourceModalOpen = ref(false);
const recognizerSourceModalRule = ref('');
const recognizerSourceModalCode = ref('');
const recognizerSourceModalError = ref('');
const recognizerSourceModalLoading = ref(false);
async function openRecognizerSourceModal(rule: string) {
  recognizerSourceModalRule.value = rule;
  recognizerSourceModalOpen.value = true;
  recognizerSourceModalError.value = '';
  const cached = recognizerSourceCache.get(rule);
  if (cached !== undefined) {
    recognizerSourceModalCode.value = cached;
    recognizerSourceModalLoading.value = false;
    return;
  }
  recognizerSourceModalCode.value = '';
  recognizerSourceModalLoading.value = true;
  try {
    const res = await $fetch<{ rule: string; content: string }>(`/api/recognizer-source/${rule}`);
    recognizerSourceCache.set(rule, res.content);
    recognizerSourceModalCode.value = res.content;
  } catch (err) {
    // A rule missing from the server's own allowlist, or a genuinely
    // missing file on disk, both 404 via `createError({statusMessage})`
    // server-side — but ofetch's own `FetchError.statusMessage` is the raw
    // HTTP status TEXT ("Not Found"), not that JSON body; the real message
    // lives on `err.data.statusMessage`/`err.data.message` (`err.data` is
    // ofetch's parsed response body). Fall back through both plus the
    // generic `Error.message` for a network-level failure with no response
    // at all (offline, CORS, etc).
    const data = err && typeof err === 'object' ? (err as { data?: { statusMessage?: unknown; message?: unknown } }).data : undefined;
    const message =
      (typeof data?.statusMessage === 'string' && data.statusMessage) ||
      (typeof data?.message === 'string' && data.message) ||
      (err instanceof Error ? err.message : 'Unknown error');
    recognizerSourceModalError.value = `Could not load recognizer source for "${rule}": ${message}`;
  } finally {
    recognizerSourceModalLoading.value = false;
  }
}

// Copy-fact-context button, sitting next to the debug-JSON braces icon in the
// same cell: copies a full one-line context string — "<set>/<number> #<row
// number> [source|sink] <label>[ · <conditions>]" (e.g. "fin/21 #3 [source]
// Dying · yours · (Creature/Artifact) permanent · once per turn") — built
// from the SAME rendered `factLabel`/`factConditions` text already shown in
// this row's own cells, not reformatted from raw JSON. `#<row number>` is
// the fact's 1-based position in the table's own DISPLAYED order
// (`factOrderIndex`, already computed below for the Interactions panel's own
// reordering — matches what a person actually sees counting rows down the
// table, not raw synergy.json source/sink array order). The bracketed
// `[source]`/`[sink]` tag mirrors this row's own role icon (`log-out`/blue =
// source, `log-in`/green = sink, just above) — spelled out in full rather
// than abbreviated ("SO"/"SI", used by an earlier now-removed version of
// this button) since the whole point of this string is unambiguous parsing
// by whoever it's pasted to (typically an AI agent), and a full word in its
// own delimiter reads as a role tag at a glance with zero risk of being
// mistaken for label text. `copiedFactKey` briefly swaps the button's own
// icon to a checkmark as click feedback, keyed by `row.key` so only the
// clicked row's button flips.
const copiedFactKey = ref<string | null>(null);
function factContextText(row: FactRow): string {
  const cardRef = `${route.params.set}/${route.params.number}`;
  const index = factOrderIndex.value.get(row.key);
  const role = row.fact.role === 'source' ? 'source' : 'sink';
  const label = factLabel(row.fact);
  const conditions = factConditions(row.fact);
  const text = conditions ? `${label} · ${conditions}` : label;
  return `${cardRef} #${index === undefined ? '?' : index + 1} [${role}] ${text}`;
}
async function copyFactContext(row: FactRow) {
  await navigator.clipboard.writeText(factContextText(row));
  copiedFactKey.value = row.key;
  setTimeout(() => {
    if (copiedFactKey.value === row.key) copiedFactKey.value = null;
  }, 1000);
}

// Every fact — including `addMana` events — renders as its own plain row,
// same convention as any other fact (no card-owned grouping/collapsing;
// see .claude/contracts/card-schema.md for what's engine- vs. card-owned).
// Source-array-then-sink-array — synergy.json's own authored order, the
// order a human reads the file in. This is only the BASE order now, not
// the final displayed one — `factRowGroups` below reorders each group by
// printed oracle-text position (`orderByTextPosition`,
// app/lib/factOrder.ts), using this authored order purely as the
// predecessor-lookup/tiebreak sequence for a fact with no textual anchor
// of its own. `FactRow` itself is defined there too (shared with
// `orderByTextPosition`'s own signature) rather than redeclared here.
// Every visible fact (source + sink), synergy.json's own authored order —
// shared by `factRows` below, `headerFaceFacts`, and passed straight down
// to FunctionalModelText.vue (its own `facts` prop) so it can build its
// per-line highlighted segments off each fact's own baked `annotations`.
const allSynergyFacts = computed<Fact[]>(() => (synergy.value ? [...synergy.value.source, ...synergy.value.sink] : []));
const factRows = computed<FactRow[]>(() => allSynergyFacts.value.map((fact) => ({ fact, key: factKey(fact) })));

// Multi-face Facts split (Adventure-layout Town lands, e.g. fin/293
// Zanarkand, Ancient Metropolis // Lasting Fayth) — the user wants the
// flat Facts table grouped by which face of the card each fact belongs to
// ("Main card" = the front face, "Other faces/functions" = everything
// else) rather than one undifferentiated list. Only rendered when there's
// actually more than one face (`annotatedFaces.value.length > 1`) — the
// vast majority of cards are single-faced and keep today's flat,
// ungrouped table exactly as before.
//
// Placement signal: the fact's own author-set `Fact.face`
// (functional-model/synergy.ts) — `'front'` -> Main card, `'back'` -> Other
// faces/functions, see `isMainFaceFact` below, defined alongside
// `factRowGroups` since it's the actual per-row grouping decision. This
// used to be inferred purely from `annotateOracleText`'s oracle-text
// linking (a fact found in face 0's own oracleLines was "Main card",
// anything else — including a fact linked to NO face at all — defaulted to
// "Other faces/functions"). That heuristic mis-filed
// sidequest-catch-a-fish-cooking-campsite's own front-face
// `wants-artifact-or-creature-on-top` sink fact (no `sourceText`/`highlight`
// match at all) into "Other faces/functions" despite it genuinely being a
// front-face effect — exactly the gap `Fact.face` was added to close.
//
// 2026-09-11 `Fact.annotations` pointer rework (see `.claude/contracts/
// card-schema.md`): the old face-0-oracleLines-match fallback heuristic
// (for a fact with no `face` set at all) is gone — under the new pointer
// model, a fact's own `annotations` are computed relative to whichever
// face `Fact.face` already names (omitted = the single face on a
// single-faced card), so there's no longer an independent signal to infer
// "front" from a text match; `factFaceIndex` below just defaults an unset
// `face` to front (0) directly, same as the pointer contract's own
// "omitted-for-single-faced" convention already implies.
const annotatedFaces = computed(() => data.value?.functionalModel?.annotatedCard?.faces ?? []);
const isMultiFace = computed(() => annotatedFaces.value.length > 1);
// A fact has a real textual anchor SOMEWHERE (any face) iff it carries at
// least one baked `Fact.annotations` entry (`AnnotationRef[]`,
// functional-model/synergy.ts, computed once by
// functional-model/scripts/compute-annotations.mjs from its own
// `sourceText`/`highlight`) — drives the Facts table's small per-row
// annotation icon. Replaces the old "walk every face's oracleLines segment
// tree looking for this fact's key" computation entirely; no server-built
// segment tree exists to walk anymore.
function isFactAnnotated(fact: Fact): boolean {
  return !!fact.annotations?.length;
}
// Reciprocal of `headerFaceFacts` below — every fact-key that ended up
// annotating the HEADER name (self-referencing, no real oracle-text anchor
// of its own) rather than a body phrase. Drives the Facts table's own row
// icon for exactly these facts: before this, a self-referencing fact (e.g.
// fin/1's "Cast a spell") rendered with no icon at all even though the
// header now underlines/tooltips it — the row looked like plain unlinked
// text while the header quietly carried the other half of the link. Same
// icon, same convention as `isFactAnnotated`'s body-link icon (see the
// Facts tab template) — the fact IS linked, just to the header instead of a
// body span, and the row should read that way too.
const headerLinkedFactKeys = computed(() => {
  const keys = new Set<string>();
  for (const facts of headerFaceFacts.value.values()) for (const f of facts) keys.add(factKey(f));
  return keys;
});
function isHeaderLinkedFact(fact: Fact): boolean {
  return headerLinkedFactKeys.value.has(factKey(fact));
}
// 0 ("front"/only face) or 1 ("back") for a raw `Fact` — the fact's own
// author-set `face` field (functional-model/synergy.ts's `Fact.face`,
// backfilled across every multi-face card in the pool) is the only signal
// now (see `annotatedFaces`'s own doc comment above for why the old
// text-match fallback heuristic is gone post-`Fact.annotations`-rework); an
// unset `face` defaults to front, matching the pointer contract's own
// "omitted-for-single-faced" convention. A genuinely single-faced card (the
// vast majority) always resolves to 0 regardless of `face` — there's no
// second face for anything to belong to. Shared by `isMainFaceFact` below
// (Facts table row grouping) and `headerFaceFacts` (the page header's own
// self-fact annotation, see below) so the two never disagree about which
// face a given fact belongs to.
function factFaceIndex(fact: Fact): number {
  if (annotatedFaces.value.length <= 1) return 0;
  return fact.face === 'back' ? 1 : 0;
}
// Replaces the old `row.fact.sourceText` hover tooltip — `sourceText`/
// `highlight` are no longer served on a `Fact` at all (moved engine-side to
// a separate, non-served `annotations-authoring.json`; see
// `.claude/contracts/card-schema.md`'s "Fact-to-oracle-text pointers"
// section) — so this derives equivalent full-sentence text straight off the
// fact's own baked `annotations` against the real served `annotatedCard`.
// `target: 'oracle'` shows the WHOLE line a span lives on (not just the
// exact highlighted substring — a full sentence reads better as a tooltip
// than a bare phrase, matching what the old `sourceText` tooltip used to
// show); `target: 'typeLine'` has no line structure to speak of, so it's
// just the exact `start`/`end` slice of the face's own single-line
// `typeLine`. A fact's `annotations` array can now have more than one real
// entry (2026-09-13 dedup-retagging pass, e.g. qiqirn-merchant/fin-65's
// merged `drawCard` fact unions a `cantrip` span and a `bigDraw` span into
// one fact) — every entry gets resolved and shown, not just the first, so
// the tooltip doesn't silently drop a real second clause the same file's
// `FunctionalModelText.vue` already highlights inline. Lines are joined
// with `\n` (a native `title` attribute renders embedded newlines fine) and
// deduped in case two annotations happen to resolve to the identical line/
// slice. Falls back to `describeFact(fact)` if this ever comes up empty
// (shouldn't happen — `annotations` is required with a minimum of one
// entry — but a raw pointer into a face that doesn't exist should never
// crash the row).
function factSourceText(fact: Fact): string {
  const face = annotatedFaces.value[factFaceIndex(fact)];
  const anns = fact.annotations ?? [];
  if (!anns.length || !face) return describeFact(fact);
  const texts: string[] = [];
  for (const ann of anns) {
    const text =
      ann.target === 'typeLine'
        ? face.typeLine.slice(ann.start, ann.end)
        : face.oracleText.split('\n')[ann.line];
    if (text && !texts.includes(text)) texts.push(text);
  }
  return texts.length ? texts.join('\n') : describeFact(fact);
}
function isMainFaceFact(row: FactRow): boolean {
  return factFaceIndex(row.fact) === 0;
}
// A self-referencing fact (`isSelfReferencing`, app/lib/factConditions.ts —
// `subject`/`target` literally `'self'`, e.g. fin/1's own "cast a spell"/
// "dies" baseline facts) describes an implicit RULES action, not something
// literally printed on the card — there's no real oracle-text span for it
// to have a baked `Fact.annotations` entry, unlike a produce/consume fact
// whose annotation points at a real printed phrase. Rather
// than leaving it entirely unlinked, it gets the exact same underline+hover
// treatment as any other annotated fact, just anchored to the CARD'S OWN
// NAME in the page header instead of a body phrase — the card itself is
// the one thing a self-referencing fact is always, unambiguously "about".
// Skips a self fact that DOES have a real match somewhere (`isFactAnnotated`
// — e.g. fin/1's own "Sacrifice after IV" self-graveyard fact, whose
// annotation genuinely points at printed text) so a fact never ends
// up double-linked (its real span AND the header) — the header is strictly
// the fallback for a fact with no textual anchor at all.
// Keyed by `factFaceIndex` (shared with `isMainFaceFact` above) so a
// back-face-only self fact (e.g. an Adventure/DFC's own back-face-only
// zone-presence fact) annotates that face's own name in the header, never
// the front/combined title.
const headerFaceFacts = computed<Map<number, Fact[]>>(() => {
  const map = new Map<number, Fact[]>();
  if (!synergy.value) return map;
  for (const fact of allSynergyFacts.value) {
    if (!isSelfReferencing(fact) || isFactAnnotated(fact)) continue;
    const idx = factFaceIndex(fact);
    const list = map.get(idx);
    if (list) list.push(fact);
    else map.set(idx, [fact]);
  }
  return map;
});
// Reciprocal direction of the header<->row link: which face name (by
// `factFaceIndex`) to visually flash while the user's hovering a
// header-linked fact row's icon in the Facts tab — passed down to
// FunctionalModelText.vue (which now owns the heading itself, and its own
// underline+hover tooltip recipe) as `headerHighlightIndex`.
const headerHighlightIndex = ref<number | null>(null);
// Template ref onto FunctionalModelText.vue's own instance — lets
// `scrollToHeaderName` below delegate into its exposed `scrollToFace`
// (see that component's own header-name markup/`defineExpose`) rather than
// this page reaching into that component's DOM/tooltip state directly.
const functionalModelTextRef = ref<{ scrollToFace: (index: number) => void } | null>(null);
// Bonus half of the reciprocal link: clicking a header-linked fact row's own
// icon (Facts tab) scrolls the face name it annotates back into view and
// pops the exact same tooltip that name's own hover shows (auto-hidden
// shortly after) — so the row's icon doesn't just look linked, clicking it
// visibly answers "linked to what" without the user hunting for the heading
// themselves.
function scrollToHeaderName(faceIndex: number) {
  functionalModelTextRef.value?.scrollToFace(faceIndex);
}
// Grouped view for the Facts tab template — a flat single group (no
// header rendered) when `!isMultiFace`, so a single-faced card's markup is
// completely unchanged; two labeled groups (skipping either one if it ends
// up empty) otherwise. Each group's own rows are further reordered by
// `orderByTextPosition` (app/lib/factOrder.ts) to follow the card's own
// printed oracle-text order (user's own request against fin/279 The Gold
// Saucer) — applied PER GROUP (front-face rows for "Main card"; every other
// face's rows for "Other faces/functions"), never one global cross-face
// position. `orderByTextPosition` no longer takes a `faces` argument
// (2026-09-11 `Fact.annotations` pointer rework) — each row's own fact
// already carries its own (line, start) position directly, no server-built
// segment tree left to walk; see that function's own doc comment.
// Full text-ordered row list, independent of the `showParserFacts` toggle —
// this (not the toggle-filtered render below) is what `factOrderIndex` is
// built from, since the Interactions panel sorts against that same index
// for EVERY interaction group, including ones whose fact happens to be a
// currently-hidden parser fact; hiding a row from the Facts tab's own
// render must not scramble that shared ordering for a still-listed
// interaction that references it.
const orderedAllFactRows = computed<FactRow[]>(() => {
  if (!isMultiFace.value) return orderByTextPosition(factRows.value);
  const main: FactRow[] = [];
  const other: FactRow[] = [];
  for (const row of factRows.value) (isMainFaceFact(row) ? main : other).push(row);
  return [...orderByTextPosition(main), ...orderByTextPosition(other)];
});
// `showParserFacts`/`showTypeDerivedFacts`/`showAiFacts` toggles all apply
// here (a row must pass ALL THREE — see `isTypeDerivedFact`'s own comment on
// why they're independent, not one implying the other) — hidden rows never
// reach the Facts tab's own render at all (not just visually collapsed), but
// visible rows keep the exact same single, text-ordered list either way:
// hiding a row never changes where its neighbors land (`orderedAllFactRows`
// above is already in final order; filtering it preserves that order).
const factRowGroups = computed<{ label: string | null; rows: FactRow[] }[]>(() => {
  const visible = orderedAllFactRows.value.filter(
    (row) =>
      (showParserFacts.value || !isParserFact(row.fact)) &&
      (showTypeDerivedFacts.value || !isTypeDerivedFact(row.fact)) &&
      (showAiFacts.value || !isAiFact(row.fact)),
  );
  if (!isMultiFace.value) return [{ label: null, rows: visible }];
  const main: FactRow[] = [];
  const other: FactRow[] = [];
  for (const row of visible) (isMainFaceFact(row) ? main : other).push(row);
  return [
    { label: 'Main card', rows: main },
    { label: 'Other faces/functions', rows: other },
  ].filter((g) => g.rows.length > 0);
});
// Total count of parser-derived facts on this card, independent of the
// toggle's own current state (unlike a "how many are hidden right now"
// count, which would go to 0 the moment the toggle is switched on and make
// its own guard/label disappear or read oddly).
const parserFactsCount = computed(() => factRows.value.filter((row) => isParserFact(row.fact)).length);
// Same reasoning, sibling count for the type-derived toggle — per-card (0
// for the vast majority of cards; only a Saga has any today).
const typeDerivedFactsCount = computed(() => factRows.value.filter((row) => isTypeDerivedFact(row.fact)).length);
// Same reasoning, third sibling count for the AI-facts toggle.
const aiFactsCount = computed(() => factRows.value.filter((row) => isAiFact(row.fact)).length);

// Every fact-key's position in the card's own text order (`orderedAllFactRows`,
// "Main card" then "Other faces/functions" — deliberately the UNFILTERED
// list, not `factRowGroups`'s toggle-filtered render, so a currently-hidden
// parser fact's own real interactions still sort correctly below rather
// than silently dropping to the end) — the single source of truth the
// Interactions panel below sorts against too (see `orderedInteractions`),
// rather than maintaining its own independent sort.
// Previously `findInteractionsForCard` (functional-model/synergy.ts) shipped
// interaction groups in plain sink-then-source authored order — the same
// order the Facts tab ITSELF used before `orderByTextPosition` was
// introduced (see that module's own header comment for why authored order
// stopped being the final word there) — so the two panels had quietly
// diverged since. Sorting here client-side (not by changing the engine's
// own `findInteractionsForCard` output — that's engine-owned per
// .claude/contracts/card-schema.md, and "which order the UI displays
// things in" is a card/UI presentation concern, not the matcher's) keeps
// the fix entirely on this side of that boundary.
const factOrderIndex = computed(() => {
  const map = new Map<string, number>();
  let i = 0;
  for (const row of orderedAllFactRows.value) map.set(row.key, i++);
  return map;
});

// Interactions panel's own groups, one per fact — reordered to match the
// Facts tab's rendered order above (each group's own `fact` is a `Fact`
// straight off this card's synergy.json, so its `factKey` always matches a
// `factRowGroups` row's own key). A group whose fact has no match at all in
// `factOrderIndex` (shouldn't happen — every interaction group's fact comes
// from this same card's own source/sink facts, all of which appear in
// `factRows`) sorts last rather than crashing or silently reordering
// unpredictably.
const orderedInteractions = computed<EnrichedInteractionGroup[]>(() => {
  const groups = data.value?.interactions ?? [];
  return [...groups].sort((a, b) => {
    const ai = factOrderIndex.value.get(factKey(a.fact));
    const bi = factOrderIndex.value.get(factKey(b.fact));
    if (ai === undefined && bi === undefined) return 0;
    if (ai === undefined) return 1;
    if (bi === undefined) return -1;
    return ai - bi;
  });
});

// Functional model's own four views, tabbed instead of stacked
// <details>/<summary> spoilers — Facts is the default (the primary,
// AI-authored+verified representation this page leads with), the other
// three are progressively rawer looks at the same card (its trace.json
// scenario log, the synergy facts as literal JSON, then the hand-authored
// CardDefinition source itself). The active tab itself lives on the shared
// store (store.functionalModelTab), not a local ref here — this page
// component unmounts/remounts navigating to/from the graph view (a
// different route), and the tab should stay put across that, not reset to
// 'facts' every time; see the store's own comment for why it's still
// session-only, not localStorage-persisted.
// Dedicated local refs for `scenariosReview`/`interactionsReview`, NOT read
// directly off `data.value.functionalModel` — confirmed the hard way ("ui"'s
// own before/after test): `useFetch`'s `data` mutated in place
// (`data.value.functionalModel[field] = ...`) never invalidated
// `functionalModelTabs`'s own `computed()` (it only tracked `data.value`
// itself as a dependency, not the nested property a plain in-place mutation
// touches), so the tab label stayed frozen at whatever it read on first
// render — no amount of re-keying the consuming component fixes that, since
// a fresh instance still reads the same stale computed output. A plain
// template expression (the Interactions header) "worked" only by accident
// (any UNRELATED re-render re-evaluates it fresh), which is why the bug was
// invisible there. These two refs are real, independently reactive state,
// synced from the server response whenever a NEW card loads, and written
// directly (not routed back through `data.value`) whenever the user toggles
// one — no computed/nested-mutation trap either way.
const factsReviewStatus = ref<'ai' | 'human'>('ai');
const scenariosReviewStatus = ref<'draft' | 'reviewed'>('draft');
const interactionsReviewStatus = ref<'draft' | 'reviewed'>('draft');
watch(
  () => data.value?.functionalModel,
  (fm) => {
    factsReviewStatus.value = fm?.review === 'human' ? 'human' : 'ai';
    scenariosReviewStatus.value = fm?.scenariosReview ?? 'draft';
    interactionsReviewStatus.value = fm?.interactionsReview ?? 'draft';
  },
  { immediate: true }
);

// Card page's own two-state fields mapped onto ReviewStatusBadge.vue's
// shared 3-way `ReviewStatus` vocabulary (app/types.ts) — a card's facts/
// scenarios/interactions are always "there" (never `'not_implemented'`,
// that value's only ever reached by the keywords page's own gap entries),
// so only the other two values are ever produced here. Purely a display
// mapping — progress.json's own stored 'ai'/'human'/'draft'/'reviewed'
// values (and review-status.ts's contract) are completely unchanged.
const factsStatus = computed<ReviewStatus>(() => (factsReviewStatus.value === 'human' ? 'human_reviewed' : 'ai_reviewed'));
const scenariosStatus = computed<ReviewStatus>(() => (scenariosReviewStatus.value === 'reviewed' ? 'human_reviewed' : 'ai_reviewed'));
const interactionsStatus = computed<ReviewStatus>(() => (interactionsReviewStatus.value === 'reviewed' ? 'human_reviewed' : 'ai_reviewed'));
// Item counts for the Facts/Json tab strip — a plain "how many rows exist"
// count, NOT a draft/review indicator (see the review-status table's own
// comment above for why THAT was deliberately pulled off the tab strip;
// this is an independent, unrelated thing). `undefined` (not `0`) whenever
// there's nothing to count — a not-yet-migrated card (`synergy` null) or a
// migrated card with genuinely zero scenarios recorded — so UTabs's own
// `v-if="item.badge || item.badge === 0"` renders no badge at all rather
// than a misleading "0"; Json/Card Definition never get one; both counts
// are `computed`, not read once, so they stay correct if `data`/`synergy`
// ever change without a full reload.
const factsCount = computed(() => (synergy.value ? synergy.value.source.length + synergy.value.sink.length : 0));
const scenariosCount = computed(() => data.value?.functionalModel?.traces?.length ?? 0);
const functionalModelTabs = computed(() => [
  { label: 'Facts', value: 'facts' as const, badge: factsCount.value || undefined },
  { label: 'Scenarios', value: 'scenarios' as const, badge: scenariosCount.value || undefined },
  { label: 'Facts Json', value: 'json' as const },
  { label: 'Card Json', value: 'cardJson' as const },
  { label: 'Card Definition', value: 'definition' as const },
]);

// Dev-only — see server/api/card/review-status.ts's own header for why
// (writes into the repo's functional-model/ source tree; refused outright
// server-side outside dev too, this just keeps a doomed-to-403 button from
// showing at all on a real deployment).
const isDev = import.meta.dev;

// POSTs cards/<slug>/progress.json's own `review`/`scenariosReview`/
// `interactionsReview` field (see server/api/card/review-status.ts) and
// updates the matching local ref above directly — no need to refetch the
// whole card just for this one field, and refetching would also re-run
// every trace live (computeTracesLive) for no reason.
//
// Optimistic: the local ref flips to its new value BEFORE the request is
// awaited (not after `res.json()` resolves), so the review-status table's
// Draft pill/Confirm button reflect the click instantly rather than waiting
// on the round-trip. `reviewStatusSaving` still disables the button while a
// request for this field is in flight (guards against a double-click racing
// two writes), but that's just a disabled state layered on top of the
// already-flipped value, not a "wait to show the change" gate. On a non-ok
// response or a thrown request, the snapshot taken before the optimistic
// flip is restored — same rollback either way.
const reviewStatusSaving = ref<'review' | 'scenariosReview' | 'interactionsReview' | null>(null);
async function toggleReviewStatus(field: 'review' | 'scenariosReview' | 'interactionsReview') {
  if (!data.value?.functionalModel || reviewStatusSaving.value) return;
  const reviewed =
    field === 'review' ? factsReviewStatus.value !== 'human' : field === 'scenariosReview' ? scenariosReviewStatus.value !== 'reviewed' : interactionsReviewStatus.value !== 'reviewed';

  const prevFacts = factsReviewStatus.value;
  const prevScenarios = scenariosReviewStatus.value;
  const prevInteractions = interactionsReviewStatus.value;
  const applyLocal = (value: 'ai' | 'human' | 'draft' | 'reviewed') => {
    if (field === 'review') factsReviewStatus.value = value as 'ai' | 'human';
    else if (field === 'scenariosReview') scenariosReviewStatus.value = value as 'draft' | 'reviewed';
    else interactionsReviewStatus.value = value as 'draft' | 'reviewed';
  };
  // Optimistic flip — happens synchronously, before the fetch below even
  // starts, so the UI never waits on the network for this.
  applyLocal(
    field === 'review' ? (reviewed ? 'human' : 'ai') : reviewed ? 'reviewed' : 'draft'
  );

  reviewStatusSaving.value = field;
  try {
    const res = await fetch('/api/card/review-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // `set`/`number`: only actually used server-side for `field ===
      // 'review'` (see review-status.ts's own oracle-text snapshot comment)
      // — sent unconditionally since this page always has them to hand
      // (its own route params) and the server ignores them for the other
      // two fields.
      body: JSON.stringify({ name: card.value!.name, field, reviewed, set: String(route.params.set), number: String(route.params.number) }),
    });
    if (res.ok) {
      // Reconcile with the server's own authoritative value (expected to
      // already match the optimistic one — this just closes the loop).
      const body = await res.json();
      if (field === 'review') factsReviewStatus.value = body.review;
      else if (field === 'scenariosReview') scenariosReviewStatus.value = body.scenariosReview;
      else interactionsReviewStatus.value = body.interactionsReview;
    } else {
      factsReviewStatus.value = prevFacts;
      scenariosReviewStatus.value = prevScenarios;
      interactionsReviewStatus.value = prevInteractions;
    }
  } catch {
    factsReviewStatus.value = prevFacts;
    scenariosReviewStatus.value = prevScenarios;
    interactionsReviewStatus.value = prevInteractions;
  } finally {
    reviewStatusSaving.value = null;
  }
}

const themeLabelById = computed(() => {
  const map = new Map<string, string>();
  data.value?.themes.forEach((t) => map.set(t.id, t.label));
  return map;
});

// Same chip/column pipeline TooltipView.vue uses for the hover popup — this
// page shows the same info, just as a dedicated route instead of a tooltip.
const relationChips = computed(() => {
  if (!data.value) return [];
  return data.value.edges.flatMap((e) => {
    const label = themeLabelById.value.get(e.theme) ?? e.theme;
    return describeRelation(label, e.role, e.weight).map((chip, i) => ({ ...chip, key: `${e.theme}-${i}` }));
  });
});
const chipColumns = computed(() => groupChipsByVerb(relationChips.value));

useHead(() => ({ title: card.value ? card.value.name : 'Card' }));

// Left/right arrow keys walk the same Previous/Next target the links below
// do — this page has no text inputs, so no need to guard against typing.
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowLeft' && prevTarget.value) navigateTo(`/app/card/${prevTarget.value.set}/${prevTarget.value.collectorNumber}`);
  else if (e.key === 'ArrowRight' && nextTarget.value) navigateTo(`/app/card/${nextTarget.value.set}/${nextTarget.value.collectorNumber}`);
}
onMounted(() => {
  window.addEventListener('keydown', onKeydown);
  loadFilterOrder();
});
onUnmounted(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
  <div class="flex-1 overflow-y-auto p-6">
    <!-- Header row (Back-to-graph link + Previous/#N/Next) — deliberately
         OUTSIDE the pending/error/loaded branches below, and rendered
         unconditionally: it never disappears behind the spinner during any
         navigation, only the inner card-detail content below it does.
         Nothing here actually depends on `card`/`data` having resolved yet —
         `deckQty` already guards itself (`v-if`, returns null with no
         card), `currentNumber` reads straight off the route param, and
         `prevTarget`/`nextTarget` are themselves route/setOrder-derived, not
         fetched-card-derived. Previously this whole block sat inside
         `template v-else` (fetched-card-only), which meant it vanished
         along with everything else the instant a Previous/Next click
         flipped `pending` back to true — fixed per direct request; the
         `hasLoadedCard`/pending gate below still exists for the exact same
         flash-avoidance reason it always did, it just no longer covers this
         region. -->
    <div class="mb-4 flex items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        <NuxtLink to="/app" class="inline-block text-sm text-muted hover:text-text">&larr; Back to graph</NuxtLink>
        <span v-if="deckQty" class="rounded-full bg-bg px-2 py-0.5 text-xs font-bold text-muted" title="Copies in your imported deck">
          ×{{ deckQty }}
        </span>
      </div>
      <div class="flex items-center gap-3 text-sm">
        <NuxtLink v-if="prevTarget" :to="`/app/card/${prevTarget.set}/${prevTarget.collectorNumber}`" class="text-muted hover:text-text">
          &larr; Previous
        </NuxtLink>
        <span v-else class="text-muted/40">&larr; Previous</span>
        <span class="text-muted">#{{ route.params.number }}</span>
        <NuxtLink v-if="nextTarget" :to="`/app/card/${nextTarget.set}/${nextTarget.collectorNumber}`" class="text-muted hover:text-text">
          Next &rarr;
        </NuxtLink>
        <span v-else class="text-muted/40">Next &rarr;</span>
      </div>
    </div>

    <!-- Everything below is the actual card-detail CONTENT (CardMedia, the
         review-status table, the functional-model tabs, Interactions,
         ...) — this is the only region the pending/error/loaded gate below
         covers now. -->
    <div v-if="pending && !hasLoadedCard" class="flex flex-1 items-center justify-center">
      <div
        class="size-8 animate-spin rounded-full border-[3px] border-border border-t-produce"
        aria-hidden="true"
      ></div>
    </div>
    <div v-else-if="error || !card" class="text-muted">Card not found.</div>
    <template v-else>
      <!-- CardMedia + the review-status table side by side once there's
           room (md and up); stacked (table below the images) on narrow/
           mobile viewports, same "stack on narrow, row on wide" shape as
           the rest of the app's own responsive containers. items-start so
           the table doesn't stretch to the image column's own height. -->
      <div class="flex flex-col items-start gap-4 md:flex-row">
        <CardMedia :images="card.images" :tokens="card.tokens" />

        <!-- Review-status overview — one small table, not a per-tab/
             per-section badge. Used to be three separate ReviewStatusBadge
             call sites (top of the Facts tab's own content, top of
             Scenarios', beside the Interactions heading) plus, at various
             points earlier this session, a UTabs tab-strip badge — all
             removed in favor of this single table so switching tabs never
             hides a row's status, and the tab strip itself carries no
             draft/review indicator at all anymore. All three rows always
             render now (Facts/Scenarios/Interactions), regardless of
             whether that section actually has anything in it yet — same
             "show the true empty state, don't hide the section" reasoning
             the tab-strip's own item counts use (a 0-count tab and an
             always-present confirm row are the same idea). Each row's own
             `readonly` still requires BOTH dev AND `data.functionalModel`
             (a functional-model/cards/<slug> folder existing at all) —
             `toggleReviewStatus`'s own no-op guard already refuses to POST
             without one (its endpoint 404s on a missing folder either way,
             since all three fields' progress.json lives there), so a
             not-yet-migrated card's rows render with a disabled confirm
             button rather than one that silently does nothing on click.
             ONE button column (no separate Draft pill) —
             `ReviewStatusBadge`'s own `variant="button"` renders the
             section's current status as the button's own label/styling
             (small, muted throughout — "Confirm" reads a shade more
             prominent than "Unconfirm" only so the two stay
             distinguishable, neither is a loud color). Same shared status
             computeds/toggleReviewStatus (and its already-optimistic local
             state flip) as before — no parallel status system, just a
             different layout for the same data. -->
        <div class="mt-2 shrink-0">
          <table class="border-collapse text-xs">
            <thead>
              <tr class="text-left text-[10px] font-semibold tracking-wide text-muted uppercase">
                <th class="py-1 pr-4">Facts</th>
                <th class="py-1"></th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="py-1 pr-4 align-middle">Facts</td>
                <td class="py-1 align-middle">
                  <ReviewStatusBadge
                    variant="button"
                    :status="factsStatus"
                    :readonly="!(isDev && data?.functionalModel)"
                    :pending="reviewStatusSaving === 'review'"
                    @confirm="toggleReviewStatus('review')"
                  />
                </td>
              </tr>
              <tr>
                <td class="py-1 pr-4 align-middle">Scenarios</td>
                <td class="py-1 align-middle">
                  <ReviewStatusBadge
                    variant="button"
                    :status="scenariosStatus"
                    :readonly="!(isDev && data?.functionalModel)"
                    :pending="reviewStatusSaving === 'scenariosReview'"
                    @confirm="toggleReviewStatus('scenariosReview')"
                  />
                </td>
              </tr>
              <tr>
                <td class="py-1 pr-4 align-middle">Interactions</td>
                <td class="py-1 align-middle">
                  <ReviewStatusBadge
                    variant="button"
                    :status="interactionsStatus"
                    :readonly="!(isDev && data?.functionalModel)"
                    :pending="reviewStatusSaving === 'interactionsReview'"
                    @confirm="toggleReviewStatus('interactionsReview')"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- functional-model/ — a declarative CardDefinition
           (functional-model/card.ts) run through real, mutable game state
           (functional-model/state.ts) across its own scenarios.ts. Primary
           position right under the card now (not a comparison column
           anymore) — synergy-model is deprecated (see its own README/
           SCHEMA.md banners) and forge-model was removed outright
           (2026-09-11, GPL-3.0 exposure cleanup — it was dead code), this
           is the current direction. -->
      <div v-if="data?.functionalModel" class="mt-2">
        <!-- Real structured per-face card data (server/api/card/[set]/
             [number].ts) — `oracleText` served raw/untouched; the component
             itself builds plain-run/fact-linked-run segments client-side
             from each visible fact's own baked `Fact.annotations`
             (functional-model/synergy.ts's `AnnotationRef`, the 2026-09-11
             pointer rework — see `.claude/contracts/card-schema.md`) rather
             than receiving a pre-built segment tree. Hover a
             dotted-underline phrase to see the same role/value info the
             Facts tab's own table shows per row, anchored to the exact
             words that fact came from. Sits above the tabs (not inside the
             Facts one) since it's a separate thing — the card's own
             annotated text, not one of the four data views below. -->
        <div v-if="data.functionalModel.annotatedCard" class="mb-2">
          <FunctionalModelText
            ref="functionalModelTextRef"
            :card="data.functionalModel.annotatedCard"
            :facts="allSynergyFacts"
            :highlight-key="hoveredFactKey"
            :self-facts="headerFaceFacts"
            :header-highlight-index="headerHighlightIndex"
            @hover="hoveredFactKey = $event"
          />
        </div>

        <!-- Same "strip only, content switched separately" split AppHeader.vue's
             own filter-mode UTabs already uses — nothing here depends on
             UTabs rendering slotted content itself. No draft/review
             indicator lives on the tab strip (or per-tab content) at all —
             see the review-status table above this block for where that
             now lives, once, covering every section regardless of which
             tab is active. -->
        <UTabs v-model="store.functionalModelTab.value" :items="functionalModelTabs" variant="link" size="xs" class="mb-2" />

        <template v-if="store.functionalModelTab.value === 'facts'">
          <!-- Three-way fact-provenance filter, one compact line (2026-09-14
               condensed from two separate, count-gated rows into this —
               user request: always visible regardless of per-card counts,
               short labels). Each fact falls into exactly one of these three
               buckets (`isAiFact`/`isTypeDerivedFact`/`isParserFact`'s own
               comments) but the toggles are still ANDed independently in
               `factRowGroups`, not mutually exclusive by construction — see
               that computed's own comment. All three render inline in the
               SAME single text-ordered table below, never a separate
               section (`feedback_facts_text_order_role_icon_only`).
               "type-keywords" = the type-derived subset (structural, e.g. a
               Saga's lore/sacrifice facts); "other" = every other
               parser-derived (recognizer) fact; "AI" = hand-authored, no
               `provenance` at all (default ON — see useGraphStore.ts's
               showAiFacts comment for why). -->
          <div v-if="synergy" class="mb-1.5 ml-[0.5em] flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            <UCheckbox v-model="showAiFacts" :ui="{ label: 'flex items-center gap-1 text-xs text-muted' }">
              <template #label>
                <span>AI ({{ aiFactsCount }})</span>
              </template>
            </UCheckbox>
            <span class="text-dimmed">|</span>
            <UCheckbox v-model="showTypeDerivedFacts" :ui="{ label: 'flex items-center gap-1 text-xs text-muted' }">
              <template #label>
                <span>type-keywords ({{ typeDerivedFactsCount }})</span>
              </template>
            </UCheckbox>
            <span class="text-dimmed">|</span>
            <UCheckbox v-model="showParserFacts" :ui="{ label: 'flex items-center gap-1 text-xs text-muted' }">
              <template #label>
                <span>other ({{ parserFactsCount }})</span>
              </template>
            </UCheckbox>
          </div>
          <div v-if="synergy" class="overflow-x-auto">
            <table class="border-collapse text-xs whitespace-nowrap">
              <tbody v-for="group in factRowGroups" :key="group.label ?? 'flat'">
                <!-- Group header — only rendered for a multi-face card (see
                     `factRowGroups`'s own comment); a single-faced card's
                     `label` is always null here, so nothing changes for the
                     vast majority of cards. -->
                <tr v-if="group.label">
                  <td
                    :colspan="3 + (SHOW_FACT_DEBUG_COLUMN ? 1 : 0)"
                    class="pt-2 pb-0.5 text-[10px] font-semibold tracking-wide text-muted uppercase"
                  >
                    {{ group.label }}
                  </td>
                </tr>
                <tr
                  v-for="row in group.rows"
                  :key="row.key"
                  class="align-middle"
                  :class="hoveredFactKey === factKey(row.fact) ? 'bg-surface/60' : 'hover:bg-surface/25'"
                  @mouseenter="hoveredFactKey = factKey(row.fact)"
                  @mouseleave="hoveredFactKey = null"
                >
                  <td class="py-1 px-2">
                    <span class="inline-flex items-center gap-1">
                      <Icon
                        :name="row.fact.role === 'source' ? 'lucide:log-out' : 'lucide:log-in'"
                        :class="row.fact.role === 'source' ? 'text-blue-400' : 'text-emerald-500'"
                        class="h-3.5 w-3.5"
                        :title="row.fact.role === 'source' ? 'Source — this card provides this' : 'Sink — this card wants this'"
                      />
                      <!-- One provenance icon per row, matching the three
                           filter buckets above the table (2026-09-14 — each
                           fact falls into exactly one, `isAiFact`/
                           `isTypeDerivedFact`/`isParserFact`'s own comments):
                           AI (no `provenance` at all — hand-authored, never
                           run through a recognizer), type-keywords
                           (structural, e.g. a Saga's lore/sacrifice facts),
                           or other (every other recognizer/parser fact).
                           Checked in this order since type-derived is a
                           strict SUBSET of parser-derived — must test it
                           first or it'd never be reached. -->
                      <Icon
                        v-if="isAiFact(row.fact)"
                        name="lucide:wand-sparkles"
                        class="h-3 w-3 cursor-help text-violet-400"
                        title="AI — no parser recognizer produced this fact"
                      />
                      <Icon
                        v-else-if="isTypeDerivedFact(row.fact)"
                        name="lucide:shapes"
                        class="h-3 w-3 cursor-help text-teal-400"
                        title="Type-keywords — structurally implied by this card's own printed type/supertype"
                      />
                      <Icon
                        v-else
                        name="lucide:regex"
                        class="h-3 w-3 cursor-help text-amber-400"
                        title="Other — matched by a parser recognizer"
                      />
                    </span>
                  </td>
                  <td
                    class="py-1 px-2 text-[13px] whitespace-pre-wrap text-muted"
                    :title="factSourceText(row.fact)"
                  >
                    <!-- No separate link icon anymore — every fact links to
                         something now (a real oracle-text span or, failing
                         that, the header name), so a dedicated glyph no
                         longer distinguishes anything. The label itself is
                         the hover/click target instead: a body-linked fact's
                         cross-highlight already comes free from this row's
                         own hover handlers above; a header-linked fact
                         additionally flashes + scrolls-to the header name via
                         the handlers below (see factLinkTitle/onFactLabel*). -->
                    <span
                      :class="{ 'cursor-pointer': isHeaderLinkedFact(row.fact) }"
                      :title="factLinkTitle(row.fact)"
                      @mouseenter="onFactLabelEnter(row.fact)"
                      @mouseleave="onFactLabelLeave(row.fact)"
                      @click="onFactLabelClick(row.fact)"
                    >{{ factLabel(row.fact) }}</span>
                  </td>
                  <td class="py-1 px-2 whitespace-pre-wrap text-muted/60">{{ factConditions(row.fact) }}</td>
                  <td v-if="SHOW_FACT_DEBUG_COLUMN" class="py-1 px-2">
                    <!-- Copy button sits FIRST (left) with its own extra
                         right-margin (beyond the plain `gap-1.5` used
                         everywhere else in this file), and the JSON/braces
                         debug button sits second (right) — deliberately
                         reordered + spaced apart per direct user feedback
                         ("copy button ... I keep hitting json instead"): the
                         two are similar-looking small icons right next to
                         each other, so copy (the one actually used often)
                         gets breathing room on its own right side rather than
                         living flush against the debug button. -->
                    <span class="inline-flex items-center gap-1.5">
                      <Icon
                        :name="copiedFactKey === row.key ? 'lucide:check' : 'lucide:copy'"
                        class="h-3.5 w-3.5 mr-2 cursor-pointer text-muted/50 hover:text-text"
                        title="Copy fact context (card + row number + text)"
                        @click="copyFactContext(row)"
                      />
                      <Icon
                        name="lucide:braces"
                        class="h-3.5 w-3.5 cursor-pointer text-muted/50 hover:text-text"
                        title="View this fact's raw JSON"
                        @click="openFactDebugModal(row.fact)"
                      />
                      <!-- Parser-derived facts only (`Fact.provenance.origin
                           === 'parser'`, see isParserFact) — an
                           agent-authored fact has no recognizer to show, so
                           it gets no button here at all rather than a
                           disabled one. -->
                      <Icon
                        v-if="isParserFact(row.fact)"
                        name="lucide:scroll"
                        class="h-3.5 w-3.5 cursor-pointer text-muted/50 hover:text-text"
                        :title="`View recognizer source: ${row.fact.provenance?.rule ?? ''}`"
                        @click="openRecognizerSourceModal(row.fact.provenance?.rule ?? '')"
                      />
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="text-xs text-muted italic">Not yet migrated to v2 synergy.json.</div>
        </template>

        <template v-else-if="store.functionalModelTab.value === 'scenarios'">
          <ScenarioReplay
            v-if="data.functionalModel.traces?.length"
            :traces="data.functionalModel.traces"
            :card-images="card.images"
            :card-keywords="card.keywords"
            :card-back-keywords="card.backKeywords"
            :card-power="card.power"
            :card-toughness="card.toughness"
            :card-back-power="card.backPower"
            :card-back-toughness="card.backToughness"
            :continuous-keyword-grants="data.functionalModel.continuousKeywordGrants"
          />
          <div v-else class="text-xs text-muted italic">No scenarios recorded.</div>
        </template>

        <template v-else-if="store.functionalModelTab.value === 'json'">
          <JsonHighlight
            :json="functionalModelJson ?? ''"
            class="max-h-[32rem] overflow-auto rounded border border-border bg-panel p-2"
          />
        </template>

        <template v-else-if="store.functionalModelTab.value === 'cardJson'">
          <JsonHighlight
            :json="cardJson ?? ''"
            class="max-h-[32rem] overflow-auto rounded border border-border bg-panel p-2"
          />
        </template>

        <template v-else>
          <FunctionalModelScript :code="data.functionalModel.source" />
        </template>
      </div>

      <!-- app/lib/synergyInteractions.ts's cross-card join, grouped by this
           card's own node (or, for a rule this card only bears, the rule
           owner's node — see groupInteractionsForCard) — one row per
           mechanism, with every matching pool card and a count, rather than
           one row per pair. Computed server-side from real synergy nodes,
           not pre-baked; only wired for the small worked-example pool in
           server/api/card/[set]/[number].ts (no full-corpus join yet). -->
      <div v-if="orderedInteractions.length" class="mt-4 w-full max-w-full">
        <div class="mb-1 flex items-center gap-2">
          <span class="text-[10px] font-semibold tracking-wide text-muted uppercase">Interactions</span>
        </div>
        <ul class="flex flex-col gap-1.5">
          <li
            v-for="(group, gi) in orderedInteractions"
            :key="gi"
            class="rounded-md border border-border px-2.5 py-1.5 text-xs text-text"
            :class="hoveredFactKey === factKey(group.fact) ? 'bg-surface/60' : 'bg-panel'"
            @mouseenter="hoveredFactKey = factKey(group.fact)"
            @mouseleave="hoveredFactKey = null"
          >
            <details>
              <summary class="flex cursor-pointer items-center gap-1.5">
                <Icon
                  :name="group.direction === 'source' ? 'lucide:log-out' : 'lucide:log-in'"
                  :class="group.direction === 'source' ? 'text-blue-400' : 'text-emerald-500'"
                  class="h-3.5 w-3.5 shrink-0"
                  :title="group.direction === 'source' ? 'This card is the source — other cards benefit from it' : 'This card is the beneficiary — other cards are the source'"
                />
                {{ group.description }}<span class="ml-auto shrink-0 rounded-full bg-bg px-2 py-px text-[10px] font-bold text-muted"
                  >{{ group.matches.length }} card{{ group.matches.length === 1 ? '' : 's' }}</span
                >
              </summary>
              <div class="mt-1.5 flex flex-wrap gap-1.5">
                <NuxtLink
                  v-for="m in group.matches"
                  :key="m.card"
                  :to="m.set && m.collectorNumber ? `/app/card/${m.set}/${m.collectorNumber}` : undefined"
                  class="block shrink-0"
                  :class="{ 'pointer-events-none': !(m.set && m.collectorNumber) }"
                  :title="m.selfInteraction ? `Self-interaction: ${m.selfInteraction}` : undefined"
                >
                  <img v-if="m.image" :src="m.image" :alt="m.card" class="block w-[220px] min-w-0 rounded-md" />
                  <span v-else class="flex h-[307px] w-[220px] items-center justify-center rounded-md bg-bg text-center text-xs text-muted">{{
                    m.card
                  }}</span>
                </NuxtLink>
              </div>
            </details>
          </li>
        </ul>
      </div>
      <a :href="card.scryfallUri" target="_blank" rel="noopener" class="mt-3 inline-block text-xs text-muted hover:text-text">
        View on Scryfall &rarr;
      </a>
    </template>
  </div>

  <UModal v-model:open="debugModalOpen" :close="false" :ui="{ content: 'max-w-3xl' }">
    <template #body>
      <JsonHighlight :json="debugModalContent" class="max-h-[70vh] overflow-auto rounded border border-border bg-panel p-2" />
    </template>
  </UModal>

  <UModal v-model:open="recognizerSourceModalOpen" :close="false" :ui="{ content: 'max-w-3xl' }">
    <template #body>
      <div class="mb-2 text-[10px] font-semibold tracking-wide text-muted uppercase">Recognizer: {{ recognizerSourceModalRule }}</div>
      <div v-if="recognizerSourceModalLoading" class="text-xs text-muted italic">Loading recognizer source…</div>
      <div v-else-if="recognizerSourceModalError" class="text-xs text-red-400">{{ recognizerSourceModalError }}</div>
      <FunctionalModelScript v-else :code="recognizerSourceModalCode" />
    </template>
  </UModal>
</template>
