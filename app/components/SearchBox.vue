<script setup lang="ts">
// PRD 03 "Search: find & discover" (docs/prds/03-search.md) — one search box,
// a single ranked results dropdown where each row carries its own LIVE
// "in Scope∪Deck or not" badge (find vs discover is a per-row label, not two
// separately-fetched/rendered lists — see the `rows` computed below for why
// that split caused a real bug and was replaced with this single-list
// design):
//   - A row's card is either already in the current Scope∪Deck graph
//     (store.graph) — matched purely client-side, no network — or was
//     surfaced by a live, debounced Scryfall lookup (POST /api/cards, the
//     exact same resolution path useGraphStore.ts's own query-mode `load()`
//     uses for a `?sf=` query). Discover always hits live Scryfall (never
//     just the already-tagged corpus) — an added card may have little/no
//     synergy data until tagged, which is expected/fine per the PRD.
//
// The text itself stays bound to store.searchQuery, UNCHANGED from before
// this PRD — GraphCanvas.vue's own watch(store.searchQuery, ...) still drives
// the existing type-to-dim/highlight behavior on the graph independently of
// this dropdown; this component only adds the dropdown/selection layer on
// top, it doesn't touch that mechanism at all.
//
// Default action (mouse click on a row body, or Enter while the row itself —
// not its add/remove button — has focus) is always OPEN —
// store.openCardPanel(set, number), same PRD 02 peek panel a graph-node
// click already opens, regardless of whether the row is currently in Scope
// or not. ADD/REMOVE is a genuinely separate action, a two-step keyboard
// gesture confirmed by the coordinator/user: → (ArrowRight) moves focus onto
// the active row's own add/remove button with NO side effect yet (visually
// indicated — see `armed` below); Enter WHILE armed performs the action; ←
// (ArrowLeft) moves focus back off the button with no side effect either.
// The button is a genuine TOGGLE, not a one-shot add: pressing Enter again
// while still armed flips it back (add -> remove -> add -> ...), and a row
// keeps its add/remove button for as long as its card is `discoverable`
// (see below), even after being added — so the SAME row/focus position
// keeps working across repeated toggles rather than the row disappearing
// once added. ArrowRight is NOT gated on caret position (an earlier version
// only armed when the caret sat at the end of the text — see onKeydown's own
// comment for why that was dropped after live verification surfaced a real
// mouse+keyboard interaction gap).
import { computed, inject, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { StoreKey } from '../composables/useGraphStore';
import { scryfallCardToCardData, type ScryfallCard } from '../lib/buildGraph';
import type { CardData } from '../types';

const store = inject(StoreKey)!;
const toast = useToast();

const RESULT_LIMIT = 10;
const DISCOVER_MIN_LEN = 2;
const DISCOVER_DEBOUNCE_MS = 300;

const containerEl = ref<HTMLElement | null>(null);
// UInput's own defineExpose only surfaces its inner `inputRef` (the real
// <input> DOM node) — this ref captures THAT exposed object, not a DOM node
// directly (see clearSearch's own use of it below).
const inputEl = ref<{ inputRef?: HTMLInputElement } | null>(null);
const dropdownOpen = ref(false);
const activeIndex = ref(0);
// Whether keyboard focus has moved from the active row itself onto that
// row's own add/remove button (via ArrowRight) — see this file's own header
// comment for the full two-step gesture. Reset to false any time the active
// row changes (ArrowUp/ArrowDown/hover) or the query text changes, so
// "armed" never silently survives onto a DIFFERENT row than the one it was
// set on.
const armed = ref(false);

const trimmedQuery = computed(() => store.searchQuery.value.trim());

// Cards already in the current Scope∪Deck graph matching the query — no
// network, instant, same corpus the existing dim/highlight search already
// scans (graphRenderer.ts's own refreshHighlight loops `graph.cards` the
// same way).
const graphMatches = computed<CardData[]>(() => {
  const q = trimmedQuery.value.toLowerCase();
  if (!q) return [];
  return (store.graph.value ?? { cards: [] }).cards.filter((c) => c.name.toLowerCase().includes(q));
});

// Raw, unfiltered live-Scryfall fetch results for the current query — a
// plain snapshot from whenever the debounced fetch last resolved, NOT
// reactive to Scope/Deck changes on its own. Deliberately kept WITHOUT
// re-filtering out already-in-scope matches here (an earlier version did
// that at fetch time, which is exactly the bug the coordinator flagged: a
// card added mid-session never had its row re-evaluated, since the filtered
// list was a one-time snapshot, not a live computed). `rows` below is what
// actually merges this against `graphMatches`/current membership, fresh on
// every render.
const discoverResults = ref<CardData[]>([]);
const discoverLoading = ref(false);
const discoverError = ref<string | null>(null);
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let requestToken = 0;

async function runDiscoverFetch(term: string) {
  const token = ++requestToken;
  discoverError.value = null;
  try {
    // `name:"..."` scopes the match to the card's own name (Scryfall's
    // default unprefixed search also matches oracle text, which would
    // surface a lot of irrelevant cards for a name-lookup box) — quotes
    // stripped from the raw typed text first so a stray `"` can't break out
    // of the query string.
    const safe = term.replace(/"/g, '');
    const res = await fetch('/api/cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: `name:"${safe}"` }),
    });
    const body = await res.json();
    if (token !== requestToken) return; // superseded by a newer keystroke
    if (!res.ok) {
      discoverError.value = body.error || 'Search failed';
      discoverResults.value = [];
      return;
    }
    discoverResults.value = (body.cards as ScryfallCard[]).map((c) => scryfallCardToCardData(c));
  } catch (err) {
    if (token !== requestToken) return;
    discoverError.value = err instanceof Error ? err.message : String(err);
    discoverResults.value = [];
  } finally {
    if (token === requestToken) discoverLoading.value = false;
  }
}

// Single source of truth for "does the query text imply the dropdown/
// discover-fetch should be active" — driven off the reactive query itself
// (not a native 'input' DOM event handler) so it can't race the v-model
// update that same keystroke also triggers.
watch(trimmedQuery, (term) => {
  activeIndex.value = 0;
  armed.value = false;
  dropdownOpen.value = !!term;

  if (debounceTimer) clearTimeout(debounceTimer);
  requestToken++; // invalidate any in-flight fetch for the previous term
  if (term.length < DISCOVER_MIN_LEN) {
    discoverResults.value = [];
    discoverLoading.value = false;
    discoverError.value = null;
    return;
  }
  discoverLoading.value = true;
  debounceTimer = setTimeout(() => runDiscoverFetch(term), DISCOVER_DEBOUNCE_MS);
});

// ONE merged, ranked list — not two separately-rendered find/discover arrays
// (that was the original design; replaced after a real bug report: with two
// separate lists, "added to Scope" meant a card vanished from one array and
// (on the next reactive tick) reappeared in the OTHER, which both broke
// simple index-based keyboard focus tracking and doesn't match the
// coordinator-confirmed toggle spec, where the SAME row/button keeps working
// across repeated add/remove). `inScope` and `discoverable` are both live,
// per-row booleans recomputed on every access to this computed — never
// baked into the row objects at merge time — so a Scope/Deck change always
// reflects immediately with no manual bookkeeping:
//   - `inScope`: is this card in store.graph RIGHT NOW — drives the badge.
//   - `discoverable`: did this card come back from the live Scryfall fetch
//     for the CURRENT query — drives whether an add/remove button renders
//     at all. Stays true even after the card is added (it doesn't leave
//     `discoverResults`, see that ref's own comment), so the button/toggle
//     keeps existing at the same row instead of disappearing on success. A
//     card that's ONLY ever matched via the local graph (never returned by
//     the live fetch — e.g. the fetch hasn't resolved yet, or genuinely
//     never will for a name Scryfall doesn't recognize) has no button at
//     all — nothing to toggle for a plain find match that never went
//     through discover.
interface Row {
  card: CardData;
  inScope: boolean;
  discoverable: boolean;
}
const rows = computed<Row[]>(() => {
  const q = trimmedQuery.value.toLowerCase();
  if (!q) return [];
  const inGraphIds = new Set((store.graph.value?.cards ?? []).map((c) => c.id));
  const discoverIds = new Set(discoverResults.value.map((c) => c.id));

  const byId = new Map<string, CardData>();
  for (const c of graphMatches.value) byId.set(c.id, c);
  for (const c of discoverResults.value) if (!byId.has(c.id)) byId.set(c.id, c);

  return [...byId.values()]
    .map((card) => {
      const lower = card.name.toLowerCase();
      const rank = lower === q ? 0 : lower.startsWith(q) ? 1 : 2;
      return { card, rank };
    })
    .sort((a, b) => a.rank - b.rank || a.card.name.localeCompare(b.card.name))
    .slice(0, RESULT_LIMIT)
    .map(({ card }) => ({
      card,
      inScope: inGraphIds.has(card.id),
      discoverable: discoverIds.has(card.id),
    }));
});
watch(rows, (r) => {
  if (activeIndex.value >= r.length) activeIndex.value = Math.max(0, r.length - 1);
});

function openRow(card: CardData) {
  store.openCardPanel(card.set, card.collectorNumber);
  dropdownOpen.value = false;
  armed.value = false;
}

// The add/remove button's own action, for both a mouse click (always, no
// arming needed) and Enter-while-armed (keyboard). Reads CURRENT membership
// fresh each call (not a stale closure over `row.inScope` from whenever the
// row was rendered) so two rapid toggles in a row always act on the real
// live state.
async function toggleScope(card: CardData) {
  const currentlyInScope = (store.graph.value?.cards ?? []).some((c) => c.id === card.id);
  if (currentlyInScope) {
    store.removeCardFromScope(card.id);
    toast.add({ title: `Removed ${card.name} from Scope`, color: 'neutral', icon: 'i-lucide-minus' });
    return;
  }
  const result = await store.addCardToScope(card.set, card.collectorNumber);
  if (result.ok) {
    toast.add({ title: `Added ${card.name} to Scope`, color: 'success', icon: 'i-lucide-check' });
  } else {
    toast.add({ title: 'Could not add card', description: result.error, color: 'error', icon: 'i-lucide-triangle-alert' });
  }
}

function onFocus() {
  if (trimmedQuery.value) dropdownOpen.value = true;
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    dropdownOpen.value = false;
    armed.value = false;
    return;
  }
  if (!dropdownOpen.value || rows.value.length === 0) return;
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      activeIndex.value = Math.min(activeIndex.value + 1, rows.value.length - 1);
      armed.value = false;
      break;
    case 'ArrowUp':
      e.preventDefault();
      activeIndex.value = Math.max(activeIndex.value - 1, 0);
      armed.value = false;
      break;
    case 'ArrowRight': {
      // Moves focus onto the active row's own add/remove button — only when
      // it actually has one (`discoverable`); a row with no button leaves
      // this as plain caret movement, never intercepted. No side effect yet,
      // this only arms the button (see Enter below).
      //
      // Deliberately NOT gated on caret position (an earlier version only
      // armed when the caret sat at the very end of the text) — dropped
      // after a live-verification run found a real gap: clicking the mouse
      // add/remove button and THEN switching to the keyboard re-focuses the
      // input via a fresh click, which can leave the caret mid-string rather
      // than at the end, silently defeating the old guard and making Enter
      // fall through to "open" instead of "toggle" right after a mouse
      // interaction. Arming itself has zero side effect either way (only
      // Enter-while-armed actually does anything), so the accidental-hijack
      // risk this guard was protecting against is low; simplicity/
      // reliability across mixed mouse+keyboard use won out.
      const row = rows.value[activeIndex.value];
      if (row?.discoverable) {
        e.preventDefault();
        armed.value = true;
      }
      break;
    }
    case 'ArrowLeft': {
      // Inverse of ArrowRight above — moves focus back off the button, onto
      // the row itself, no side effect. Left as plain caret movement
      // whenever the button isn't currently armed.
      if (armed.value) {
        e.preventDefault();
        armed.value = false;
      }
      break;
    }
    case 'Enter': {
      e.preventDefault();
      const row = rows.value[activeIndex.value];
      if (!row) break;
      if (armed.value && row.discoverable) {
        // Toggles add/remove; deliberately stays armed (per the confirmed
        // spec) so a SECOND Enter immediately flips it back again, rather
        // than requiring ArrowRight again each time.
        toggleScope(row.card);
      } else {
        openRow(row.card);
      }
      break;
    }
  }
}

// Click-outside — same pattern CardPeekPanel.vue's own document-level
// listener already uses elsewhere in this app (ignore anything landing
// inside this component's own container).
function onDocumentPointerdown(event: PointerEvent) {
  if (!dropdownOpen.value) return;
  const target = event.target as Node | null;
  if (containerEl.value && target && containerEl.value.contains(target)) return;
  dropdownOpen.value = false;
  armed.value = false;
}
if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', onDocumentPointerdown);
  onBeforeUnmount(() => document.removeEventListener('pointerdown', onDocumentPointerdown));
}

function clearSearch() {
  store.searchQuery.value = '';
  dropdownOpen.value = false;
  armed.value = false;
  nextTick(() => inputEl.value?.inputRef?.focus());
}
</script>

<template>
  <div ref="containerEl" class="relative w-56">
    <UInput
      ref="inputEl"
      v-model="store.searchQuery.value"
      class="w-56"
      placeholder="Search cards or themes…"
      icon="i-lucide-search"
      autocomplete="off"
      size="sm"
      @focus="onFocus"
      @keydown="onKeydown"
    >
      <template v-if="store.searchQuery.value" #trailing>
        <UButton icon="i-lucide-x" color="neutral" variant="link" size="xs" aria-label="Clear search" @click="clearSearch" />
      </template>
    </UInput>

    <div
      v-if="dropdownOpen && trimmedQuery"
      class="absolute top-full left-0 z-50 mt-1 max-h-96 w-80 overflow-y-auto rounded-md border border-border-subtle bg-panel py-1 shadow-lg"
    >
      <div
        v-for="(row, i) in rows"
        :key="row.card.id"
        class="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs"
        :class="i === activeIndex ? 'bg-surface text-text' : 'text-muted hover:bg-surface/60 hover:text-text'"
        @mouseenter="activeIndex = i; armed = false"
      >
        <button type="button" class="min-w-0 flex-1 truncate text-left" @click="openRow(row.card)">
          {{ row.card.name }}
        </button>
        <span
          class="shrink-0 rounded-sm px-1 py-0.5 text-[10px]"
          :class="row.inScope ? 'bg-muted/15 text-muted' : 'bg-warning/15 text-warning'"
        >
          <UIcon v-if="row.inScope" name="i-lucide-check" class="mr-0.5 inline size-3" />
          {{ row.inScope ? 'In scope' : 'Not in scope' }}
        </span>
        <UButton
          v-if="row.discoverable"
          :icon="row.inScope ? 'i-lucide-minus' : 'i-lucide-plus'"
          color="neutral"
          variant="subtle"
          size="xs"
          square
          :class="armed && i === activeIndex ? 'ring-2 ring-primary' : ''"
          :aria-label="row.inScope ? `Remove ${row.card.name} from Scope` : `Add ${row.card.name} to Scope`"
          @click.stop="toggleScope(row.card)"
        />
      </div>

      <div v-if="discoverLoading" class="px-2.5 py-1.5 text-[11px] text-muted italic">Searching Scryfall…</div>
      <div v-else-if="discoverError" class="px-2.5 py-1.5 text-[11px] text-error">{{ discoverError }}</div>
      <div v-else-if="!rows.length" class="px-2.5 py-1.5 text-[11px] text-muted italic">No matches.</div>
    </div>
  </div>
</template>
