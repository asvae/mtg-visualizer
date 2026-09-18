<script setup lang="ts">
// 2026-09-15: the actual card-detail CONTENT (CardMedia, review-status
// table, annotated text, Facts/Scenarios/Facts Json/Card Json/Card
// Definition tabs, Interactions, the Scryfall link) lives in
// `CardDetailTabs.vue` (app/components/) — shared with the graph page's own
// peek panel (`CardPeekPanel.vue`) so the two can never drift the way the
// panel's old separate `CardMedia`+`CardRelations` pairing did. This page
// keeps only what's genuinely PAGE-chrome: data-fetching, Previous/Next
// navigation, the deck-qty badge, and the pending/error/loading states.
//
// 2026-09-18: briefly DELETED and consolidated into
// `app/pages/app/engine/cards/[set]/[[number]].vue` (the internal
// engine-console "Cards" tab), on the reasoning that the two pages were
// rendering identical content. RESTORED same day, per explicit user
// direction: `/app/engine/*` is the internal dev/engine-console dashboard
// and this route is the real app's own user-facing card page — they're
// deliberately kept as SEPARATE ROUTES going forward even though they
// currently mount the exact same `CardDetailTabs.vue` for their content.
// "For now we use the same component, but that might diverge at some point
// in the future" — don't re-attempt this consolidation without that
// explicit sign-off. Every real graph-page-facing link
// (`RecognizerEntryCard.vue`, `SearchBox.vue`, `CardPeekPanel.vue`'s "Open
// full card page" action, `GraphCanvas.vue`'s ctrl/cmd-click new-tab link,
// `CardDetailTabs.vue`'s own matched-card thumbnail links) points HERE;
// only the engine console's own internal Cards-tab sidebar navigation
// points at `/app/engine/cards/...`.
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import type { CardResponse } from '../../../../lib/cardResponse';
import { getKnownDeckCards, getActiveFilterMode } from '../../../../composables/useGraphStore';
import { useSetOrder, neighborsInSetOrder, type SetOrderData } from '../../../../composables/useSetOrder';

definePageMeta({ layout: 'graph' });

const route = useRoute();

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
// within-set Previous/Next browsing never changes :set. Also this page's
// own handling for a card whose :set is neither `fin` nor `fdn` (any live
// `?sf=` Scryfall-query card, which can be from literally any real MTG set
// per CLAUDE.md — first-class, not a niche edge case): this composable/its
// server route (`/api/cards/set-order/:set`) were already written
// generic-over-any-set (falling back to a live Scryfall `unique=cards`
// query when the set isn't in the local `cards.db`), so no separate
// "unknown set" branch is needed here at all — same mechanism serves both.
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
    <!-- Stands in for the card IMAGE itself only (CardImageSkeleton.vue,
         shared with CardPeekPanel.vue), not a full-page loading state — no
         centering wrapper, same top-left position CardMedia occupies once
         loaded. -->
    <CardImageSkeleton v-if="pending && !hasLoadedCard" />
    <div v-else-if="error || !card" class="text-muted">Card not found.</div>
    <template v-else>
      <CardDetailTabs :data="data!" :set="String(route.params.set)" :number="String(route.params.number)" />
    </template>
  </div>
</template>
