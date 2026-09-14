import { computed, onMounted, reactive, ref, shallowRef, watch, type InjectionKey } from 'vue';
import type { CardData, Deck, DeckEntry, GraphFile, GraphReason } from '../types';
import { COLOR_ORDER, RARITY_ORDER } from '../lib/constants';
import {
  availableRarities as computeAvailableRarities,
  availableTypes as computeAvailableTypes,
  availableKeywords as computeAvailableKeywords,
} from '../lib/filters';
import { DEFAULT_FORCES, type ForceConfig, type GravityMode } from '../lib/graphRenderer';
import { buildGraph, resolveCardLinks, scryfallCardToCardData, type NameLink, type ScryfallCard, type TokensById } from '../lib/buildGraph';
import { fetchCardBySetNumber } from '../lib/cardCache';
import { parseDecklist, type ParsedDeckCard } from '../lib/deckImport';

// Storage keys referenced by the shareable-link restore block below, so
// declared before it rather than in their original historical order.
//
// PRD 01 "Core concepts" (docs/prds/01-core-concepts.md) reworked how a
// pasted decklist fits into this app: it used to BE a whole alternate Scope
// (`SET_CODE = 'deck'`, replacing whatever set/query was loaded, gated by
// AppHeader.vue's own "Global filter by deck" checkbox) — that mode, and the
// two storage keys that drove it (`mtg-visualizer-deck-import-text`,
// `mtg-visualizer-deck-active`), are gone entirely, not just renamed. A Deck
// is now its own persistent, independent collection (`DECK_STORAGE_KEY`
// below) that's UNIONED with Scope at render time (`graph` computed further
// down), never a Scope-replacing mode — pasting a decklist now just resolves
// and merges into that Deck (`importDeckFromText` below) instead of
// navigating anywhere. See this file's own `graph` computed and
// `DeckEntry`/`Deck` (app/types.ts) for the actual union mechanics.
//
// Not namespaced by SET_CODE (unlike STORAGE_KEY/FORCES_STORAGE_KEY below) —
// a Deck is deliberately independent of whichever Scope (fin/query) happens
// to be loaded, same "your deck stays visible regardless of what's currently
// in scope" framing the PRD itself uses.
const DECK_STORAGE_KEY = 'mtg-visualizer-deck';
// Query mode's own sticky breadcrumb — see its fuller comment further down
// this file, by getActiveFilterMode. Declared here (rather than in its
// original spot) only so the shareable-link restore block below can write
// it before that comment's own read sites run.
export const QUERY_ACTIVE_KEY = 'mtg-visualizer-active-query';

// Deck persistence — module-scope (not just inside useGraphStore()) since
// the standalone card detail page's own getKnownDeckCards()/
// getActiveFilterMode() below need to read the SAME persisted shape without
// a live store instance in hand (that page doesn't share this store — see
// getActiveFilterMode's own comment).
interface PersistedDeck {
  name: string;
  entries: DeckEntry[];
}
function loadPersistedDeck(): PersistedDeck | null {
  try {
    const raw = localStorage.getItem(DECK_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null; // corrupt/blocked storage — caller falls back to an empty deck
  }
}
function savePersistedDeck(deck: PersistedDeck) {
  try {
    localStorage.setItem(DECK_STORAGE_KEY, JSON.stringify(deck));
  } catch {
    // storage full/blocked — deck just won't persist across a reload
  }
}

// --- Shareable link restore --------------------------------------------
// AppHeader.vue's Share button (see buildShareUrl below) encodes the whole
// visualizer state — mode/query, deck contents, colors/rarities/types,
// search — as plain, readable `share_*` query params (nothing secret here,
// no reason to obscure it behind a base64 blob). Restoring it has to happen
// here, at the very top of this module, BEFORE `scryfallQuery` below reads
// anything: that's computed once, straight off the URL, at module-eval time
// — exactly like a real navigation would have left things, which is
// deliberately what this block produces (for query mode, rewrites the
// address bar to the same `?sf=` shape submitScryfallQuery already
// navigates to) rather than inventing a parallel "restored" code path
// elsewhere in this file. The `share_*` params themselves are stripped
// immediately after (history.replaceState, no reload, no history entry
// added) — a share link is a one-time seed, not something that should
// linger in the address bar or get re-applied on every future refresh of
// this tab.
//
// `deckText` (a plain decklist-shaped string, same grammar deckImport.ts
// parses) rides independently of `mode` now — PRD 01 made Deck a persistent
// collection unioned with Scope, not a third Scope-replacing mode
// alongside 'fin'/'query', so a shared link's deck content has to merge
// into the live Deck via `importDeckFromText` (an async network call) once
// the store actually mounts, rather than being seeded into localStorage
// synchronously here the way `mode`/`query` still are. See the onMounted
// block inside useGraphStore() below for where that merge actually happens.
export interface ShareState {
  mode: 'fin' | 'query';
  query?: string;
  deckText?: string;
  colors?: string[];
  rarities?: string[];
  types?: string[];
  search?: string;
}

function decodeShareParams(): ShareState | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const rawMode = params.get('share_mode');
  if (rawMode !== 'fin' && rawMode !== 'deck' && rawMode !== 'query') return null;
  // A link shared before this PRD's rework may still carry the old
  // `share_mode=deck` (Deck-as-a-Scope-mode) value — best-effort compat:
  // collapse it to plain 'fin' Scope, its `deckText` (read unconditionally
  // below regardless of mode) still merges into the real Deck the same as
  // any other shared deck content would.
  const mode: 'fin' | 'query' = rawMode === 'query' ? 'query' : 'fin';
  const csv = (key: string) => {
    const v = params.get(key);
    return v ? v.split(',') : undefined;
  };
  return {
    mode,
    query: params.get('share_query') ?? undefined,
    deckText: params.get('share_deck') ?? undefined,
    colors: csv('share_colors'),
    rarities: csv('share_rarities'),
    types: csv('share_types'),
    search: params.get('share_search') ?? undefined,
  };
}

// Applied once, synchronously, before anything below reads localStorage or
// the URL. `sharedState` (module-scope, not just a local) is re-read further
// down once STORAGE_KEY/SEARCH_STORAGE_KEY are known, to seed the same
// colors/rarities/types/search restore through those routes' own existing
// localStorage-shaped contract — see the second half of this restore, past
// the SET_CODE section below.
const sharedState = decodeShareParams();
if (sharedState && typeof window !== 'undefined') {
  try {
    if (sharedState.mode === 'query' && sharedState.query) {
      localStorage.setItem(QUERY_ACTIVE_KEY, sharedState.query);
    } else {
      localStorage.removeItem(QUERY_ACTIVE_KEY);
    }
  } catch {
    // storage blocked (e.g. private browsing) — mode restore just won't stick
  }
  // Rewrite the address bar to the canonical shape for whichever mode this
  // is — `?sf=<query>` for query mode (so the plain `scryfallQuery` read
  // just below sees it, same as a real `submitScryfallQuery` navigation
  // would have left), or the bare path otherwise. Either way this also
  // drops every `share_*` param — done as one replaceState rather than
  // "inject sf now, strip share_* later" so the address bar never visibly
  // shows both at once.
  const url = new URL(window.location.href);
  url.search = sharedState.mode === 'query' && sharedState.query ? `?sf=${encodeURIComponent(sharedState.query)}` : '';
  window.history.replaceState(null, '', url.toString());
}

// "sf" (scryfall filter) URL param — an arbitrary Scryfall search query,
// read once on load to switch into query mode (see load() below). Read raw
// here (module scope, not via readUrlParam below) since a query is a single
// string, not a comma-split list. This, the one-way colors/rarities/types
// read (readUrlParam below), and the shareable-link restore above are the
// only URL reads in this file — nothing here ever writes back to the URL on
// its own afterwards; see readUrlParam's own comment.
const scryfallQuery = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('sf') : null;

// Namespaces every distinct query into its own storage bucket instead of
// clobbering the main "fin" explorer's saved filters, or having every query
// share one "query" bucket and stomp on each other's saved state. No more
// 'deck' SET_CODE value (see this file's own header comment) — a Deck no
// longer replaces Scope, so it never changes what SET_CODE names for this
// purpose.
const SET_CODE = scryfallQuery ? `q:${scryfallQuery}` : 'fin';

// Whatever's currently in the persistent Deck (see DECK_STORAGE_KEY above),
// as the flat `{name, qty}[]` shape both this file's own getActiveFilterMode
// below and the standalone card-detail page (which imports this directly —
// see app/pages/app/card/[set]/[number].vue) already expect. `null` for an
// empty/nonexistent deck, never an empty array — same "absent, not empty"
// convention the old deck-import version of this function used. Reads
// straight off localStorage (module-scope, no live store instance needed)
// so the standalone card page can call this with no store injected.
export function getKnownDeckCards(): ParsedDeckCard[] | null {
  const persisted = loadPersistedDeck();
  if (!persisted) return null;
  const list = persisted.entries.filter((e) => e.quantity > 0).map((e) => ({ name: e.card.name, qty: e.quantity }));
  return list.length ? list : null;
}

// Query mode's own sticky breadcrumb (QUERY_ACTIVE_KEY, declared near the
// top of this file) — unlike `sf` itself (real, shareable URL content, read
// fresh above), a query-mode session otherwise has NO way to signal itself
// outside that URL param. That's fine for the main graph page (it re-reads
// `sf` every load anyway) but breaks the standalone card detail page below:
// GraphCanvas.vue opens it via `window.open` with a bare
// `/app/card/<set>/<number>` URL, no query string carried over, so without
// this it has no way to even know a query filter is active elsewhere, let
// alone what it was. AppHeader.vue writes/clears this (see
// submitScryfallQuery below) — sticky, explicit-clear-only, not auto-cleared
// by a bare `/app` visit.

export type ActiveFilter = { mode: 'deck'; cards: { name: string; qty: number }[] } | { mode: 'query'; query: string } | null;

// Single source of truth for "is a global card filter active right now, and
// what defines it" — read by the standalone card detail page to scope its
// own Previous/Next to whichever filter's card list, since that page has no
// access to the main graph's own already-loaded `store.graph.value.cards`
// (a deliberately standalone route — see that page's own header comment).
// Deck wins whenever it has any entries at all — PRD 01 dropped the old
// "Global filter by deck" checkbox that used to gate this (Deck no longer
// competes with Scope for what the MAIN graph shows, so there's nothing left
// to opt into there), but this page's own Previous/Next and Interactions-
// panel scoping is still a genuinely useful "browse just my deck" mode, and
// having any Deck entries at all is the closest still-meaningful signal for
// it. Flagged for `card` lane to sanity-check: this makes that scoping
// switch on automatically the moment a Deck is non-empty, where it used to
// require an explicit opt-in.
export function getActiveFilterMode(): ActiveFilter {
  const deck = getKnownDeckCards();
  if (deck) return { mode: 'deck', cards: deck };
  try {
    const q = localStorage.getItem(QUERY_ACTIVE_KEY);
    return q ? { mode: 'query', query: q } : null;
  } catch {
    return null;
  }
}
const STORAGE_KEY = `mtg-visualizer-filters-${SET_CODE}`;
const FORCES_STORAGE_KEY = `mtg-visualizer-forces-${SET_CODE}`;
const SEARCH_STORAGE_KEY = `mtg-visualizer-search-${SET_CODE}`;
// Separate key, not folded into FORCES_STORAGE_KEY's own JSON blob — that
// one's sanitized as a flat numeric-fields-only object (see
// loadSavedForces/NUMERIC_FORCE_KEYS below), and a non-numeric value there
// would just get silently dropped by that same guard.
const GRAVITY_MODE_STORAGE_KEY = `mtg-visualizer-gravity-mode-${SET_CODE}`;
// Not namespaced by SET_CODE — unlike the filter/force state above, "which of
// the four functional-model views you last looked at" isn't really a
// per-set preference, just a standing UI habit.
const FUNCTIONAL_MODEL_TAB_STORAGE_KEY = 'mtg-visualizer-functional-model-tab';
// Same "standing UI habit, not a per-set preference" reasoning as the tab key
// above — the Facts tab's "show parser-derived facts" checkbox
// (functional-model/PRD_AUTOMATED_AUTHORING.md).
const SHOW_PARSER_FACTS_STORAGE_KEY = 'mtg-visualizer-show-parser-facts';
// Same reasoning again, sibling checkbox (2026-09-14) — "show type-derived
// facts" (functional-model/recognizers/types.ts's own
// `TYPE_DERIVED_RECOGNIZER_IDS` doc comment), independent of the toggle
// above: a fact can be parser-derived, type-derived, both, or neither.
const SHOW_TYPE_DERIVED_FACTS_STORAGE_KEY = 'mtg-visualizer-show-type-derived-facts';
// Same reasoning again, third sibling checkbox (2026-09-14) — "show AI facts"
// (Fact.provenance absent — hand-authored, never run through a recognizer).
// Default ON (true), unlike the two above: these were unconditionally shown
// before this toggle existed, so a fresh/never-saved viewer sees no change.
const SHOW_AI_FACTS_STORAGE_KEY = 'mtg-visualizer-show-ai-facts';
// PRD 04 "List view" — same "standing UI habit, not a per-set preference"
// reasoning as the two keys just above: which renderer (graph nodes vs. a
// sortable table) you last looked at isn't a statement about a particular
// Scope/set, so this isn't namespaced by SET_CODE either.
const VIEW_MODE_STORAGE_KEY = 'mtg-visualizer-view-mode';
// CardPeekPanel.vue's own drag-to-resize width — same "standing UI habit, not
// a per-set preference" reasoning as the two keys above: how wide someone
// likes the peek panel isn't a statement about a particular Scope/set either.
const PANEL_WIDTH_STORAGE_KEY = 'mtg-visualizer-card-panel-width';
// Exported so CardPeekPanel.vue's own drag handle clamps against the exact
// same numbers this file uses to sanitize a restored value — one source of
// truth, not two copies that could drift apart. Min keeps card art +
// CardRelations chips usable; max leaves most of the viewport for the
// graph/list behind it on a typical laptop-width screen (a raw vw-based cap
// is layered on top of this in the component itself, for a narrow window).
export const PANEL_WIDTH_MIN = 280;
export const PANEL_WIDTH_MAX = 720;
export const PANEL_WIDTH_DEFAULT = 360; // matches CardPeekPanel.vue's pre-resize fixed width
export function clampPanelWidth(w: number): number {
  return Math.min(PANEL_WIDTH_MAX, Math.max(PANEL_WIDTH_MIN, w));
}
// PRD 01 "Core concepts" — Scope's own per-card add/remove overlay (see
// `scopeAdded`/`scopeRemoved` inside useGraphStore() below), namespaced by
// SET_CODE same as the filter/force state above: an individually-added or
// -removed card is a statement about THIS particular bulk pool (this FIN
// visit, or this specific `?sf=` query), not a global preference that should
// leak into an unrelated one.
const SCOPE_EDITS_STORAGE_KEY = `mtg-visualizer-scope-edits-${SET_CODE}`;

// Second half of the shareable-link restore started near the top of this
// file — colors/rarities/types/search couldn't be applied there since
// STORAGE_KEY/SEARCH_STORAGE_KEY (namespaced by SET_CODE) weren't known
// yet. Seeded into localStorage under the exact keys/shape
// loadSavedFilters()/the search-box restore below already read, rather than
// adding a second, parallel "restored state" code path — a shared link ends
// up indistinguishable from a visit that had these saved from before.
if (sharedState) {
  try {
    if (sharedState.colors || sharedState.rarities || sharedState.types) {
      const payload: SavedFilters = {
        colors: sharedState.colors ?? [],
        rarities: sharedState.rarities ?? [],
        types: sharedState.types ?? [],
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    }
    if (sharedState.search) localStorage.setItem(SEARCH_STORAGE_KEY, sharedState.search);
  } catch {
    // storage blocked — filters/search just won't restore, mode still will
  }
}

interface SavedFilters {
  colors: string[];
  rarities: string[];
  types: string[];
  // Optional (not `?? []`-defaulted at the type level) — a blob saved before
  // this feature existed simply won't have these keys, and JSON.parse won't
  // invent them; applySavedFilters below treats their absence as "empty
  // set"/"off", same neutral default a fresh, never-saved visit already gets.
  keywords?: string[];
  // Absence means "on" (true) here, unlike every other optional field in
  // this interface, which defaults to "off"/empty — `showSynergyEdges`'s own
  // default IS true (see its declaration above), so a blob saved before this
  // field existed, or before its predecessor `sourceSinkOnly` was redesigned
  // into this, correctly falls back to the new normal/default look rather
  // than silently hiding every synergy edge. Deliberately not read from a
  // stale `sourceSinkOnly` key either — that field's OLD meaning (isolate to
  // a topological pure-producer->pure-consumer subset) doesn't map onto this
  // one's meaning (plain show/hide of everything) at all, so an old saved
  // value is just orphaned/ignored rather than reinterpreted.
  showSynergyEdges?: boolean;
}

function loadSavedFilters(): SavedFilters | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null; // corrupt/blocked storage — fall back to defaults, never throw
  }
}

// One-way URL read only, on initial load — the landing page's archetype
// links (`/app?colors=R,G`) preset a filter this way. Deliberately NOT
// mirrored back to the URL: filters persist to localStorage instead (see
// STORAGE_KEY below), so the address bar stays whatever the visitor
// landed on/typed, never rewritten as they click checkboxes or cards.
function readUrlParam(key: string): string[] | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  if (!params.has(key)) return null;
  const raw = params.get(key)!;
  return raw ? raw.split(',') : [];
}

// Numeric force sliders' own fields only — anything malformed (wrong type,
// NaN, or left over from an older schema this key's shape has since changed
// under) is dropped per-field rather than poisoning the whole object, so a
// stale/corrupt localStorage value can't hand PhysicsControls.vue's
// `v.toFixed()` a non-number and crash the popover on every future load
// (reloading never fixes it either, since the bad value just gets re-read
// from storage every time) — each dropped field falls back to
// DEFAULT_FORCES the same way a genuinely absent key already did.
const NUMERIC_FORCE_KEYS: (keyof ForceConfig)[] = [
  'cardCharge',
  'gravity',
  'linkStrength',
  'linkDistanceScale',
  'collidePadding',
  'alphaDecay',
  'velocityDecay',
  'sourceNormBudget',
  'sinkNormBudget',
  'qtyBoost',
];
function loadSavedForces(): Partial<ForceConfig> | null {
  try {
    const raw = localStorage.getItem(FORCES_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const sanitized: Partial<ForceConfig> = {};
    for (const key of NUMERIC_FORCE_KEYS) {
      const v = parsed[key];
      if (typeof v === 'number' && Number.isFinite(v)) sanitized[key] = v;
    }
    return sanitized;
  } catch {
    return null;
  }
}

export interface HoveredCard {
  kind: 'card';
  card: CardData;
  links: { card: CardData; reasons: GraphReason[] }[];
}

// Single shared store for this single-instance app — simpler than Pinia for a graph
// this small, provided to the tree once from App.vue via provide/inject.
export function useGraphStore() {
  // Re-asserts the share-link URL cleanup from the restore block near the
  // top of this file, once mounted. The module-scope replaceState up there
  // runs during setup (before/during hydration) and gets stomped right back
  // to the original `?share=...` URL by Nuxt/vue-router's own hydration
  // reconciliation, which resolves the client route from the URL it saw at
  // SSR time — confirmed by testing (the actual restore — localStorage
  // seeding, colors/search — sticks fine; only the visible address bar kept
  // reverting). onMounted fires strictly after that reconciliation settles,
  // so this write wins.
  if (sharedState && typeof window !== 'undefined') {
    onMounted(() => {
      const url = new URL(window.location.href);
      url.search = sharedState.mode === 'query' && sharedState.query ? `?sf=${encodeURIComponent(sharedState.query)}` : '';
      window.history.replaceState(null, '', url.toString());
      // A shared link's own deck content (see ShareState's own comment) is
      // an async merge into the real Deck, not a synchronous localStorage
      // seed the way mode/query/colors/etc. are above — `importDeckFromText`
      // isn't defined until further down this function, but by the time this
      // callback actually RUNS (after mount, not during this synchronous
      // setup pass) it already is; swallow a failure here the same way a
      // network hiccup anywhere else in this file is swallowed rather than
      // crashing the whole page over a share-link's deck half.
      if (sharedState.deckText) importDeckFromText(sharedState.deckText, 'merge').catch(() => {});
    });
  }

  // The bulk-loaded pool only — see the `graph` computed further down for
  // the actual Scope∪Deck union every consumer (GraphCanvas, FilterPanel,
  // ...) reads. Kept internal (not returned from this composable) since
  // nothing outside this file should ever read the pre-union graph.
  const baseGraph = shallowRef<GraphFile | null>(null);
  // The FULL card<->card NameLink[] pool from `/api/graph-links` (keyed by
  // card name, not id — see NameLink's own comment in buildGraph.ts),
  // retained across the whole session (not just used once inside
  // buildGraph() the way it was before PRD 01) so the `graph` computed below
  // can re-resolve links against whatever the CURRENT effective card set is
  // — including individually added Scope cards and Deck entries buildGraph()
  // itself never sees, since it only ever runs once, on the bulk pool, at
  // load() time.
  const graphLinksPool = shallowRef<NameLink[]>([]);
  const loadError = ref<string | null>(null);
  // True from just before load()'s first fetch until it settles (success or
  // error) — App.vue shows a loading overlay while this is true. Starts true
  // (not false) so the overlay is up from first paint, not just after
  // onMounted() calls load() a tick later.
  const loading = ref(true);
  // Non-blocking, distinct from loadError: the graph still loaded fine, this
  // just says the "sf" query matched more cards than /api/cards will return.
  const dataWarning = ref<string | null>(null);

  // --- Scope edits (PRD 01 "Core concepts") --------------------------------
  // Scope stays the perf-bounded bulk pool `load()` below fetches (whichever
  // of 'fin'/a Scryfall query), but is now individually editable on top of
  // that: `scopeAdded` holds cards fetched one at a time (addCardToScope,
  // reusing the same `/api/card/[set]/[number]` route + frontend cache the
  // Deck side below uses) that AREN'T part of the bulk pool; `scopeRemoved`
  // hides a card (bulk-loaded or individually added, doesn't matter) from
  // view without literally "un-fetching" it. Both namespaced by SET_CODE
  // (SCOPE_EDITS_STORAGE_KEY above) — an edit is a statement about THIS
  // particular bulk pool, not a standing global preference.
  const savedScopeEdits = ((): { added: CardData[]; removed: string[] } | null => {
    try {
      const raw = localStorage.getItem(SCOPE_EDITS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  })();
  const scopeAdded = reactive(new Map<string, CardData>((savedScopeEdits?.added ?? []).map((c) => [c.id, c])));
  const scopeRemoved = reactive(new Set<string>(savedScopeEdits?.removed ?? []));
  const scopeEditsPayload = computed(() => ({ added: [...scopeAdded.values()], removed: [...scopeRemoved] }));
  watch(scopeEditsPayload, (payload) => {
    try {
      localStorage.setItem(SCOPE_EDITS_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // storage full/blocked — scope edits just won't persist across a reload
    }
  });

  // PRD 03 "Search" — Scope's own perf cap (same 500 server/api/cards.ts's
  // own MAX_CARDS already enforces for a bulk `?sf=` query) applies here too,
  // now that a card can be added one at a time via a discover search result.
  // Deliberately NOT the union `graph` computed's own card count (that also
  // includes Deck, which is an explicit unconstrained sandbox per PRD 01 —
  // this cap is a statement about Scope alone) — the same dedupe-by-id
  // logic the `graph` computed uses for its own Scope half, just without the
  // Deck union folded in.
  const SCOPE_CAP = 500;
  // PRD 04 "List view" — the actual Scope MEMBERSHIP (not just its count),
  // exposed so a renderer that already has a card's full CardData in hand
  // (a list row, sourced from the Scope∪Deck union `graph` below) can tell
  // "is this specific card in Scope right now" apart from "is it merely
  // visible via Deck" — the union itself doesn't carry that distinction on
  // the card object. `scopeCardCount` now derives from this instead of
  // duplicating the same loop.
  const scopeCardIds = computed(() => {
    const base = baseGraph.value;
    const ids = new Set<string>();
    if (!base) return ids;
    for (const c of base.cards) if (!scopeRemoved.has(c.id)) ids.add(c.id);
    for (const c of scopeAdded.values()) if (!scopeRemoved.has(c.id)) ids.add(c.id);
    return ids;
  });
  const scopeCardCount = computed(() => scopeCardIds.value.size);

  // Adds ONE card to Scope via a single targeted request for that card
  // (server/api/card/[set]/[number].ts, the same route the card detail page
  // uses) — never a re-fetch of the whole bulk pool. Repeat calls for a
  // card already fetched this session (by anyone — Scope, Deck, a search
  // discover result) are served from app/lib/cardCache.ts instead of hitting
  // the network again. Re-adding a previously-removed card un-hides it.
  // Refuses (no partial/silent add — state is untouched on a `{ok: false}`
  // return) if this card is genuinely NEW to Scope and Scope is already at
  // SCOPE_CAP; re-adding a card Scope already effectively has (bulk pool or
  // a previous scopeAdded entry) never counts against the cap, since it
  // doesn't grow Scope's size at all.
  //
  // `presetCard` (PRD 04 "List view" addition) — a list row already holds
  // this exact card's full CardData (it came FROM the Scope∪Deck union in
  // the first place, e.g. re-adding a Deck-only card back into Scope), so
  // forcing another `fetchCardBySetNumber` round trip would be a pointless
  // network call most of that time it's not already cache-warm. When
  // provided, skips the fetch entirely and reuses it directly; every other
  // caller (SearchBox's discover rows, which never have the card in hand
  // ahead of the fetch) omits it and keeps the original fetch-then-add path
  // unchanged.
  async function addCardToScope(set: string, number: string, presetCard?: CardData): Promise<{ ok: true } | { ok: false; error: string }> {
    const card = presetCard ?? (await fetchCardBySetNumber(set, number));
    if (!card) return { ok: false, error: 'Card not found' };
    const alreadyCounted = !scopeRemoved.has(card.id) && ((baseGraph.value?.cards.some((c) => c.id === card.id) ?? false) || scopeAdded.has(card.id));
    if (!alreadyCounted && scopeCardCount.value >= SCOPE_CAP) {
      return { ok: false, error: `Scope is already at its ${SCOPE_CAP}-card limit — remove a card before adding another.` };
    }
    scopeRemoved.delete(card.id);
    scopeAdded.set(card.id, card);
    return { ok: true };
  }
  // Hides a card from view regardless of whether it came from the bulk pool
  // or was individually added — "remove from view" is just "not in either
  // side of the union anymore" (see the `graph` computed below), so this
  // never needs to distinguish the two.
  function removeCardFromScope(cardId: string) {
    scopeAdded.delete(cardId);
    scopeRemoved.add(cardId);
  }

  // --- Deck (PRD 01 "Core concepts") ---------------------------------------
  // `{ name, entries: [{ card, quantity }] }` — no format, no legality, no
  // quantity caps, ever (a deliberate sandbox, see app/types.ts's own
  // Deck/DeckEntry doc comment). Persisted globally (DECK_STORAGE_KEY, NOT
  // namespaced by SET_CODE) since a Deck is independent of whatever Scope
  // happens to be loaded. `deckEntries` is keyed by card id for cheap
  // add/set/remove; `deck` below is the plain `{name, entries: DeckEntry[]}`
  // shape other code (and, soon, PRD 03/04's own UI) actually wants.
  const savedDeck = loadPersistedDeck();
  const deckName = ref(savedDeck?.name ?? 'My Deck');
  const deckEntries = reactive(new Map<string, DeckEntry>((savedDeck?.entries ?? []).map((e) => [e.card.id, e])));
  const deck = computed<Deck>(() => ({ name: deckName.value, entries: [...deckEntries.values()] }));
  watch(deck, (d) => savePersistedDeck(d));

  // Adds ONE card to the Deck via the same single targeted request/cache
  // addCardToScope above uses — a genuinely new card (not currently in the
  // Deck) starts at `quantity`; an already-present one just adds to its
  // existing quantity. No validation/cap of any kind, per the PRD.
  async function addCardToDeck(set: string, number: string, quantity = 1): Promise<{ ok: true } | { ok: false; error: string }> {
    const card = await fetchCardBySetNumber(set, number);
    if (!card) return { ok: false, error: 'Card not found' };
    const existing = deckEntries.get(card.id);
    deckEntries.set(card.id, { card, quantity: (existing?.quantity ?? 0) + quantity });
    return { ok: true };
  }
  // Dropping to (or below) 0 removes the entry entirely — per PRD 01's own
  // design note, that's the WHOLE mechanism for "this card leaves view
  // unless Scope separately still has it," not a separate rule layered on
  // top (see the `graph` computed below, which simply never sees a
  // quantity-0 entry in the first place).
  //
  // `presetCard` (PRD 04 "List view" addition) — before this, there was no
  // caller that could hit the "no existing entry yet" branch with quantity >
  // 0 at all (this function silently no-op'd for a genuinely new card,
  // since only addCardToDeck — a separate, always-fetches path — could
  // create one). A list row's own quantity stepper needs to go straight
  // from 0 to N for a card that isn't in the Deck yet, and already has that
  // card's full CardData in hand (it came from the Scope∪Deck union in the
  // first place) — so a NEW entry can now be created here directly, with no
  // network round trip, as long as the caller supplies it. Omitted, this
  // keeps its original "only ever touches an existing entry" behavior
  // exactly as before.
  function setDeckEntryQuantity(cardId: string, quantity: number, presetCard?: CardData) {
    if (quantity <= 0) {
      deckEntries.delete(cardId);
      return;
    }
    const existing = deckEntries.get(cardId);
    if (existing) deckEntries.set(cardId, { ...existing, quantity });
    else if (presetCard) deckEntries.set(cardId, { card: presetCard, quantity });
  }
  function removeDeckEntry(cardId: string) {
    deckEntries.delete(cardId);
  }
  function renameDeck(name: string) {
    deckName.value = name;
  }
  function clearDeck() {
    deckEntries.clear();
  }

  // Bulk-resolves a whole pasted decklist in ONE request (app/lib/
  // deckImport.ts's parseDecklist, same permissive multi-format grammar the
  // old Scope-replacing "Import deck" feature already used) and merges every
  // recognized line into the Deck — this is a deliberate bulk action (a
  // paste is inherently "many cards at once"), distinct from the single-card
  // targeted fetch addCardToScope/addCardToDeck above use; PRD 01's "single
  // targeted request" constraint is about an individual add/remove, not this.
  // 'merge' (default) adds to whatever's already in the Deck (an existing
  // entry's quantity increases by the pasted line's own qty, same as
  // addCardToDeck above); 'replace' empties the Deck first. Returns
  // `unmatched` (names /api/cards/by-names couldn't resolve) for the caller
  // to surface, same "recognized N, missed these" feedback the old feature
  // gave.
  async function importDeckFromText(text: string, mode: 'merge' | 'replace' = 'merge'): Promise<{ importedCount: number; unmatched: string[] }> {
    const parsed = parseDecklist(text);
    if (!parsed.length) return { importedCount: 0, unmatched: [] };
    const res = await fetch('/api/cards/by-names', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ names: [...new Set(parsed.map((c) => c.name))] }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || `deck import failed (${res.status})`);
    // Keyed by every name a decklist might reference a card by — its own
    // top-level name (a DFC's is both faces joined by " // ") AND each
    // individual face's name, same front-face fallback the rest of this
    // file already uses for the same reason.
    const byName = new Map<string, ScryfallCard>();
    for (const c of body.cards as ScryfallCard[]) {
      byName.set(c.name, c);
      for (const f of c.card_faces ?? []) if (f.name) byName.set(f.name, c);
    }
    if (mode === 'replace') deckEntries.clear();
    const unmatched: string[] = [];
    for (const { name, qty } of parsed) {
      const raw = byName.get(name);
      if (!raw) {
        unmatched.push(name);
        continue;
      }
      const card = scryfallCardToCardData(raw);
      const existing = deckEntries.get(card.id);
      deckEntries.set(card.id, { card, quantity: (existing?.quantity ?? 0) + qty });
    }
    return { importedCount: parsed.length - unmatched.length, unmatched };
  }

  // The Scope∪Deck union PRD 01 calls for, computed fresh whenever any of
  // its inputs change (the bulk pool itself, an individual Scope add/remove,
  // or a Deck entry's quantity) — every real consumer (GraphCanvas,
  // FilterPanel, TooltipView via `hovered`) reads THIS, never `baseGraph`
  // directly. A Deck entry's own `quantity` is stamped onto its card as
  // `qty` (the same field the existing ×N badge/qty-boost-physics code
  // already reads — see graphRenderer.ts/TooltipView.vue — unchanged by this
  // PRD) so it renders correctly regardless of whether that card ALSO
  // happens to be in Scope. Links are re-resolved from the full
  // `graphLinksPool` against whatever this union's cards actually are —
  // `baseGraph.links` itself is never read here (buildGraph() still
  // computes it, harmlessly unused, since dropping it would mean forking
  // buildGraph() into two variants for no real benefit).
  const graph = computed<GraphFile | null>(() => {
    const base = baseGraph.value;
    if (!base) return null;
    const cardsById = new Map<string, CardData>();
    for (const c of base.cards) if (!scopeRemoved.has(c.id)) cardsById.set(c.id, c);
    for (const c of scopeAdded.values()) if (!scopeRemoved.has(c.id)) cardsById.set(c.id, c);
    for (const entry of deckEntries.values()) {
      if (entry.quantity <= 0) continue;
      const existing = cardsById.get(entry.card.id);
      cardsById.set(entry.card.id, { ...(existing ?? entry.card), qty: entry.quantity });
    }
    const cards = [...cardsById.values()];
    return { set: base.set, cards, links: resolveCardLinks(cards, graphLinksPool.value) };
  });

  const selectedColors = reactive(new Set<string>());
  const selectedRarities = reactive(new Set<string>());
  const selectedTypes = reactive(new Set<string>());
  // Keywords (FilterPanel.vue's "Edges" section) — unlike the three axes
  // above, defaults to its neutral/off state (empty set) rather than
  // "everything selected": most cards carry no BADGE_KEYWORDS at all.
  // Persisted to localStorage the same way colors/rarity/type are (see
  // filterPayload/applySavedFilters below) — NOT mirrored to the URL/
  // share-link the way colors/rarity/type optionally are, since nothing
  // asked for that yet.
  const selectedKeywords = reactive(new Set<string>());
  // Plain show/hide over ALL card-to-card synergy edges (graphRenderer.ts's
  // own `showSynergyEdges` RenderOptions field has the full comment) —
  // `true` (checked) is the default/normal look; unchecking removes every
  // synergy edge entirely (not just fades it), leaving only keyword-hub
  // edges (a separate category) if any are active. Named/shaped this way
  // after a redesign — an earlier version (`showSourceSinkOnly`) isolated
  // the graph down to a topological pure-producer->pure-consumer SUBSET
  // instead, which turned out not to match what was actually wanted; see
  // this session's own design notes for the full history.
  const showSynergyEdges = ref(true);

  // PROTOTYPE (see .claude/agent-memory/ui/notes.md's own design writeup) —
  // generalizes the keyword-hub mechanism above to ordinary synergy edges: a
  // (source card, matched fact) pair whose fan-out crosses this threshold
  // auto-collapses into a synthetic "relation hub" instead of drawing one
  // real link per target (graphRenderer.ts's own RelationHubState). Off by
  // default and deliberately NOT persisted to localStorage the way every
  // other filter/force above is — a temporary dev toggle for evaluating the
  // idea, not a real setting yet. FilterPanel.vue's own "Relation hubs
  // (prototype)" control is the only place these are read from.
  const relationHubsEnabled = ref(false);
  const relationHubThreshold = ref(20);

  // Click-to-select highlight on card nodes — ephemeral exploration state, not
  // persisted anywhere (not URL, not localStorage) and compounds with search
  // in the graph's highlight/dim pass. Ctrl/Cmd-click is handled entirely in
  // GraphCanvas.vue (opens Scryfall instead of calling this at all) — never
  // reaches here.
  const cardSelection = reactive(new Set<string>());
  function toggleCardSelection(cardId: string, additive: boolean) {
    if (additive) {
      if (cardSelection.has(cardId)) cardSelection.delete(cardId);
      else cardSelection.add(cardId);
      return;
    }
    if (cardSelection.size === 1 && cardSelection.has(cardId)) {
      cardSelection.clear(); // clicking the sole selected card again deselects it
    } else {
      cardSelection.clear();
      cardSelection.add(cardId); // plain click replaces the selection
    }
  }

  // --- Card peek panel (PRD 02 "Navigation") -------------------------------
  // The panel's own open/closed state (and which card) IS the `?card=`
  // query param — not a separate ref kept in sync with it. `router.replace`
  // (never `push`) on every open/switch/close: this is a "peek," and a
  // person exploring the graph will click through many nodes in a row —
  // `push`ing one history entry per peek would mean many "back" presses just
  // to leave the page at all, which doesn't match the "lightweight glance"
  // the PRD is going for. `useRoute`/`useRouter` (Nuxt/vue-router
  // auto-imports — same as every other `.vue` file in this app already uses
  // bare, see e.g. `app/layouts/graph.vue`) rather than this file's own
  // usual raw `window.location`/`URLSearchParams` reads: those are one-way,
  // read-once-at-module-eval reads (share links, `sf`/`colors`/...); this
  // needs live, two-way, reactive sync while the app is already running, which
  // is exactly what `useRoute`/`useRouter` are for. Only usable here (inside
  // the `useGraphStore()` function body), not at this file's module scope,
  // same reason `onMounted` above is inside this function and not up there.
  //
  // Deliberately does NOT gate itself to the graph page here — the actual
  // "never shows on a direct full-page visit" guarantee comes from
  // `CardPeekPanel.vue` only ever being MOUNTED from `app/pages/app/index.vue`
  // (never from the card detail page's own route), not from this state
  // itself refusing to hold a value elsewhere. A `?card=` param that somehow
  // survived onto some other route is simply inert there — nothing reads it.
  const route = useRoute();
  const router = useRouter();
  const panelCardKey = computed<string | null>(() => {
    const raw = route.query.card;
    return typeof raw === 'string' && raw ? raw : null;
  });
  function openCardPanel(set: string, collectorNumber: string) {
    router.replace({ query: { ...route.query, card: `${set}/${collectorNumber}` } });
  }
  function closeCardPanel() {
    if (!route.query.card) return; // already closed — avoid a no-op history entry
    const query = { ...route.query };
    delete query.card;
    router.replace({ query });
  }

  // Restored synchronously, same as the physics sliders below — no graph dependency,
  // so the search box shows its saved value from the very first render instead of
  // flashing empty then re-populating once the graph loads.
  let savedSearch = '';
  try {
    savedSearch = localStorage.getItem(SEARCH_STORAGE_KEY) ?? '';
  } catch {
    // storage blocked (e.g. private browsing) — just start empty
  }
  const searchQuery = ref(savedSearch);
  watch(searchQuery, (q) => {
    try {
      localStorage.setItem(SEARCH_STORAGE_KEY, q);
    } catch {
      // storage full/blocked — search just won't persist
    }
  });

  const panelOpen = ref(false);
  const legendOpen = ref(false);
  const physicsOpen = ref(false);

  // Restored synchronously (no graph/network dependency, unlike the filter Sets),
  // so sliders reflect the saved values from the very first render.
  const savedForces = loadSavedForces();
  const cardCharge = ref(savedForces?.cardCharge ?? DEFAULT_FORCES.cardCharge);
  const gravity = ref(savedForces?.gravity ?? DEFAULT_FORCES.gravity);
  const linkStrength = ref(savedForces?.linkStrength ?? DEFAULT_FORCES.linkStrength);
  const alphaDecay = ref(savedForces?.alphaDecay ?? DEFAULT_FORCES.alphaDecay);
  const velocityDecay = ref(savedForces?.velocityDecay ?? DEFAULT_FORCES.velocityDecay);
  const sourceNormBudget = ref(savedForces?.sourceNormBudget ?? DEFAULT_FORCES.sourceNormBudget);
  const sinkNormBudget = ref(savedForces?.sinkNormBudget ?? DEFAULT_FORCES.sinkNormBudget);
  const qtyBoost = ref(savedForces?.qtyBoost ?? DEFAULT_FORCES.qtyBoost);
  // collidePadding/linkDistanceScale are no longer user-tunable (sliders removed) —
  // fixed at their DEFAULT_FORCES value regardless of what an older save might
  // have, never read from/written to storage.
  const linkDistanceScale = ref(DEFAULT_FORCES.linkDistanceScale);
  const collidePadding = ref(DEFAULT_FORCES.collidePadding);

  // 'default' (usual force layout) or 'manaCost' (a mana curve — see
  // graphRenderer.ts's own GravityMode/setGravityMode). Restored synchronously
  // same as the sliders above, and sanitized against a stale/corrupt value
  // the same reason loadSavedForces guards the numeric sliders — an
  // unrecognized string here would otherwise reach GraphCanvas.vue's watch
  // and get handed straight to the renderer.
  let savedGravityMode: GravityMode = 'default';
  try {
    const raw = localStorage.getItem(GRAVITY_MODE_STORAGE_KEY);
    if (raw === 'manaCost') savedGravityMode = 'manaCost';
  } catch {
    // storage blocked — just start on 'default'
  }
  const gravityMode = ref<GravityMode>(savedGravityMode);
  watch(gravityMode, (mode) => {
    try {
      localStorage.setItem(GRAVITY_MODE_STORAGE_KEY, mode);
    } catch {
      // storage full/blocked — mode just won't persist
    }
  });

  function resetForces() {
    cardCharge.value = DEFAULT_FORCES.cardCharge;
    gravity.value = DEFAULT_FORCES.gravity;
    linkStrength.value = DEFAULT_FORCES.linkStrength;
    alphaDecay.value = DEFAULT_FORCES.alphaDecay;
    velocityDecay.value = DEFAULT_FORCES.velocityDecay;
    sourceNormBudget.value = DEFAULT_FORCES.sourceNormBudget;
    sinkNormBudget.value = DEFAULT_FORCES.sinkNormBudget;
    qtyBoost.value = DEFAULT_FORCES.qtyBoost;
  }

  // Bumped by the "Rerender" button — GraphCanvas watches this and rebuilds the
  // whole layout from scratch (every node's position cleared, simulation restarted
  // at full alpha), for when the graph settled into a bad/clumped-up local layout
  // and tweaking force sliders alone won't shake it loose.
  const rerenderTrigger = ref(0);
  function rerenderLayout() {
    rerenderTrigger.value++;
  }

  watch([cardCharge, gravity, linkStrength, alphaDecay, velocityDecay, sourceNormBudget, sinkNormBudget, qtyBoost], () => {
    const payload: Pick<
      ForceConfig,
      'cardCharge' | 'gravity' | 'linkStrength' | 'alphaDecay' | 'velocityDecay' | 'sourceNormBudget' | 'sinkNormBudget' | 'qtyBoost'
    > = {
      cardCharge: cardCharge.value,
      gravity: gravity.value,
      linkStrength: linkStrength.value,
      alphaDecay: alphaDecay.value,
      velocityDecay: velocityDecay.value,
      sourceNormBudget: sourceNormBudget.value,
      sinkNormBudget: sinkNormBudget.value,
      qtyBoost: qtyBoost.value,
    };
    try {
      localStorage.setItem(FORCES_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // storage full/blocked — physics settings just won't persist
    }
  });

  const hovered = shallowRef<HoveredCard | null>(null);
  const mouseX = ref(0);
  const mouseY = ref(0);

  // Card detail page's Facts/Scenarios/JSON/Definition tab — lives here (not
  // a local ref on that page) so it survives navigating away and back (this
  // store outlives the page component; see graph.vue's layout-level provide),
  // AND persisted to localStorage, same sanitize-against-a-stale-value
  // reasoning as gravityMode above.
  const FUNCTIONAL_MODEL_TABS = ['facts', 'scenarios', 'json', 'cardJson', 'definition'] as const;
  type FunctionalModelTab = (typeof FUNCTIONAL_MODEL_TABS)[number];
  let savedFunctionalModelTab: FunctionalModelTab = 'facts';
  try {
    const raw = localStorage.getItem(FUNCTIONAL_MODEL_TAB_STORAGE_KEY);
    if ((FUNCTIONAL_MODEL_TABS as readonly string[]).includes(raw ?? '')) savedFunctionalModelTab = raw as FunctionalModelTab;
  } catch {
    // storage blocked — just start on 'facts'
  }
  const functionalModelTab = ref<FunctionalModelTab>(savedFunctionalModelTab);
  watch(functionalModelTab, (tab) => {
    try {
      localStorage.setItem(FUNCTIONAL_MODEL_TAB_STORAGE_KEY, tab);
    } catch {
      // storage full/blocked — tab just won't persist
    }
  });

  // Facts tab's "show parser-derived facts" checkbox — same
  // survive-navigation-and-persist treatment as functionalModelTab just
  // above (default OFF, same as the card page's own prior local-ref default).
  let savedShowParserFacts = false;
  try {
    savedShowParserFacts = localStorage.getItem(SHOW_PARSER_FACTS_STORAGE_KEY) === 'true';
  } catch {
    // storage blocked — just start hidden
  }
  const showParserFacts = ref(savedShowParserFacts);
  watch(showParserFacts, (shown) => {
    try {
      localStorage.setItem(SHOW_PARSER_FACTS_STORAGE_KEY, shown ? 'true' : 'false');
    } catch {
      // storage full/blocked — toggle just won't persist
    }
  });

  // Facts tab's sibling "show type-derived facts" checkbox — same
  // survive-navigation-and-persist treatment, own storage key, independent
  // state (see SHOW_TYPE_DERIVED_FACTS_STORAGE_KEY's own comment above).
  let savedShowTypeDerivedFacts = false;
  try {
    savedShowTypeDerivedFacts = localStorage.getItem(SHOW_TYPE_DERIVED_FACTS_STORAGE_KEY) === 'true';
  } catch {
    // storage blocked — just start hidden
  }
  const showTypeDerivedFacts = ref(savedShowTypeDerivedFacts);
  watch(showTypeDerivedFacts, (shown) => {
    try {
      localStorage.setItem(SHOW_TYPE_DERIVED_FACTS_STORAGE_KEY, shown ? 'true' : 'false');
    } catch {
      // storage full/blocked — toggle just won't persist
    }
  });

  // Facts tab's third sibling "show AI facts" checkbox — same
  // survive-navigation-and-persist treatment, own storage key, independent
  // state, default ON (see SHOW_AI_FACTS_STORAGE_KEY's own comment above).
  let savedShowAiFacts = true;
  try {
    const raw = localStorage.getItem(SHOW_AI_FACTS_STORAGE_KEY);
    if (raw !== null) savedShowAiFacts = raw === 'true';
  } catch {
    // storage blocked — just start at the default (shown)
  }
  const showAiFacts = ref(savedShowAiFacts);
  watch(showAiFacts, (shown) => {
    try {
      localStorage.setItem(SHOW_AI_FACTS_STORAGE_KEY, shown ? 'true' : 'false');
    } catch {
      // storage full/blocked — toggle just won't persist
    }
  });

  // PRD 04 "List view" — which renderer (graph nodes vs. a sortable table)
  // is currently shown; AppHeader.vue's own view-mode toggle is the only
  // writer. Restored synchronously (no graph/network dependency), same
  // sanitize-against-a-stale-value treatment as gravityMode/functionalModelTab
  // above.
  let savedViewMode: 'graph' | 'list' = 'graph';
  try {
    if (localStorage.getItem(VIEW_MODE_STORAGE_KEY) === 'list') savedViewMode = 'list';
  } catch {
    // storage blocked — just start on 'graph'
  }
  const viewMode = ref<'graph' | 'list'>(savedViewMode);
  watch(viewMode, (mode) => {
    try {
      localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
    } catch {
      // storage full/blocked — mode just won't persist
    }
  });

  // CardPeekPanel.vue's own drag-to-resize width. Restored synchronously, same
  // sanitize-against-a-stale-value treatment as gravityMode/viewMode above —
  // an out-of-range or corrupt saved number (a manually-edited localStorage
  // value, or PANEL_WIDTH_MIN/MAX shrinking in a future change) is clamped
  // back into range rather than handed straight to the panel's own inline
  // width style.
  let savedPanelWidth = PANEL_WIDTH_DEFAULT;
  try {
    const raw = Number(localStorage.getItem(PANEL_WIDTH_STORAGE_KEY));
    if (Number.isFinite(raw) && raw > 0) savedPanelWidth = clampPanelWidth(raw);
  } catch {
    // storage blocked — just start at the default width
  }
  const panelWidth = ref(savedPanelWidth);
  watch(panelWidth, (w) => {
    try {
      localStorage.setItem(PANEL_WIDTH_STORAGE_KEY, String(w));
    } catch {
      // storage full/blocked — width just won't persist
    }
  });

  const availableRarities = ref<string[]>([]);
  const availableTypes = ref<string[]>([]);

  // Guards against persisting an empty/default state before load() has restored
  // (or defaulted) the real selection — flips true once that settles.
  let readyToPersist = false;

  function selectAllColors() {
    selectedColors.clear();
    COLOR_ORDER.forEach((c) => selectedColors.add(c));
  }
  function selectAllRarities() {
    selectedRarities.clear();
    availableRarities.value.forEach((r) => selectedRarities.add(r));
  }
  function selectAllTypes() {
    selectedTypes.clear();
    availableTypes.value.forEach((t) => selectedTypes.add(t));
  }

  // Colors/Rarity/Type only — deliberately does NOT touch selectedKeywords,
  // showSynergyEdges, or the relation-hub prototype's own
  // relationHubsEnabled/relationHubThreshold. Those all live in FilterPanel's
  // "Edges" section, but per the user's own explicit call, that section
  // isn't a filter the same way Colors/Rarity/Type are (it never hides a
  // CARD — a keyword hub is a synthetic node, showSynergyEdges toggles
  // visibility of the synergy-edge category as a whole, relation hubs
  // collapse rendering, not membership), so bundling their reset into THIS
  // button would surprise someone who just wanted to re-widen an attribute
  // filter back out. If a reset affordance for the Edges section is ever
  // wanted, it should be its own separate control, not folded in here.
  function resetFilters() {
    selectAllColors();
    selectAllRarities();
    selectAllTypes();
  }

  // Plain snapshot of the filter state that gets persisted to localStorage —
  // watched once below instead of one imperative localStorage.setItem() call
  // per filter mutation site.
  const filterPayload = computed<SavedFilters>(() => ({
    colors: [...selectedColors],
    rarities: [...selectedRarities],
    types: [...selectedTypes],
    keywords: [...selectedKeywords],
    showSynergyEdges: showSynergyEdges.value,
  }));

  function applySavedFilters(data: GraphFile, rarities: string[], types: string[], keywords: string[]) {
    const stored = loadSavedFilters();
    // A URL query param, when present, wins over whatever's in localStorage for
    // that one key — an explicit/shared URL is a more deliberate statement of
    // intent than whatever was left over from a previous visit. A category
    // absent from BOTH the URL and localStorage means "unconstrained" (every
    // color/rarity/type), not "select nothing" — a link that only constrains
    // e.g. colors (the landing page's archetype links) should leave
    // rarities/types open, even for a first-time visitor with no localStorage yet.
    const urlColors = readUrlParam('colors');
    const urlRarities = readUrlParam('rarities');
    const urlTypes = readUrlParam('types');
    if (!stored && urlColors === null && urlRarities === null && urlTypes === null) {
      return false; // nothing specified anywhere — caller applies its own full defaults
    }

    const validColors = new Set(COLOR_ORDER);
    selectedColors.clear();
    (urlColors ?? stored?.colors ?? COLOR_ORDER).filter((c) => validColors.has(c)).forEach((c) => selectedColors.add(c));

    const validRarities = new Set(rarities);
    selectedRarities.clear();
    (urlRarities ?? stored?.rarities ?? rarities).filter((r) => validRarities.has(r)).forEach((r) => selectedRarities.add(r));

    const validTypes = new Set(types);
    selectedTypes.clear();
    (urlTypes ?? stored?.types ?? types).filter((t) => validTypes.has(t)).forEach((t) => selectedTypes.add(t));

    // No URL param for either (unlike colors/rarity/type above) — restored
    // from localStorage alone, or left at their already-empty/off default
    // (an older saved blob predating this feature simply lacks these keys,
    // same as a genuinely fresh visit; see SavedFilters' own comment).
    // Keywords are validated against THIS corpus's own available keywords
    // (a saved "Flying" from a previous FIN visit shouldn't silently persist
    // into an unrelated `?sf=` query that has no flyers at all) — same
    // stale-value guard colors/rarities/types already get above.
    const validKeywords = new Set(keywords);
    selectedKeywords.clear();
    (stored?.keywords ?? []).filter((k) => validKeywords.has(k)).forEach((k) => selectedKeywords.add(k));
    // `?? true`, not `?? false` — see SavedFilters.showSynergyEdges' own
    // comment for why this one field's absence means "on," unlike every
    // other optional field restored here.
    showSynergyEdges.value = stored?.showSynergyEdges ?? true;

    return true;
  }

  async function load() {
    loading.value = true;
    try {
      // Raw pieces only — no pre-built graph file. The visualizer assembles
      // cards/links itself (see app/lib/buildGraph.ts); tokens are optional (a
      // missing fetch:tokens run just means no hover images, not a load failure).
      // Only two bulk-pool shapes left (plain 'fin', or a Scryfall query) —
      // the old third 'deck' branch is gone; a Deck no longer replaces this
      // pool at all (see this file's own header comment and the `graph`
      // computed above, which unions it in at render time instead).
      let raw: ScryfallCard[];
      let links: NameLink[];
      let tokensById: TokensById;
      if (scryfallQuery !== null) {
        // Query mode: resolve against the Netlify function instead of the
        // static per-set files — see netlify/functions/cards.mts. No token
        // images in this mode (function doesn't fetch them), so no hover art.
        const [res, linksRes] = await Promise.all([
          fetch('/api/cards', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ q: scryfallQuery }),
          }),
          fetch('/api/graph-links'),
        ]);
        const body = await res.json();
        if (!res.ok) {
          loadError.value = body.error || `query failed (${res.status})`;
          return;
        }
        raw = body.cards;
        links = linksRes.ok ? ((await linksRes.json()).links as NameLink[]) : [];
        tokensById = {};
        dataWarning.value = body.truncated
          ? `Showing ${body.cards.length} of ${body.totalCards} matching cards — narrow your search to see the rest.`
          : null;
      } else {
        let graphLinks: { links: NameLink[] };
        [graphLinks, raw, tokensById] = await Promise.all([
          fetch('/api/graph-links').then((r) => r.json()),
          fetch(`/${SET_CODE}/${SET_CODE}_scryfall.json`).then((r) => r.json()),
          fetch(`/${SET_CODE}/${SET_CODE}_tokens_scryfall.json`).then((r) => (r.ok ? r.json() : {})),
        ]);
        links = graphLinks.links;
      }
      const data: GraphFile = buildGraph(SET_CODE, raw, tokensById, links);
      baseGraph.value = data;
      graphLinksPool.value = links;

      const rarities = computeAvailableRarities(data, RARITY_ORDER);
      const types = computeAvailableTypes(data);
      const keywords = computeAvailableKeywords(data);
      availableRarities.value = rarities;
      availableTypes.value = types;

      if (!applySavedFilters(data, rarities, types, keywords)) {
        // No saved filters (first visit) — default to every color/rarity/type.
        // Keywords/Source-Sink already start at their correct off/empty
        // default (see their own declaration above) — nothing to do here.
        selectAllColors();
        rarities.forEach((r) => selectedRarities.add(r));
        types.forEach((t) => selectedTypes.add(t));
      }

      readyToPersist = true;
    } catch (err) {
      loadError.value = err instanceof Error ? err.message : String(err);
    } finally {
      loading.value = false;
    }
  }

  // Colors/Rarity/Type/Keyword facets recomputed whenever the EFFECTIVE
  // (Scope∪Deck) graph changes, not just once at load() time — an
  // individually-added Scope card or Deck entry can introduce a rarity/type
  // the base bulk pool never had at all, which would otherwise render fine
  // but sit permanently hidden behind Colors/Rarity/Type with no checkbox
  // ever able to turn it back on (Colors itself doesn't have this problem —
  // COLOR_ORDER/selectAllColors are a fixed, non-corpus-dependent list
  // already). Only ever WIDENS selectedRarities/selectedTypes for a value
  // that's genuinely new since the last check (never narrows — a value the
  // user deliberately deselected stays deselected). Gated on readyToPersist
  // purely defensively (see its own declaration) — load()'s own initial
  // availableRarities/Types assignment always happens-before this watcher's
  // first run in practice, so this never actually overrides a restored
  // saved-filter selection.
  watch(graph, (g) => {
    if (!g || !readyToPersist) return;
    const rarities = computeAvailableRarities(g, RARITY_ORDER);
    const types = computeAvailableTypes(g);
    const prevRarities = new Set(availableRarities.value);
    const prevTypes = new Set(availableTypes.value);
    availableRarities.value = rarities;
    availableTypes.value = types;
    for (const r of rarities) if (!prevRarities.has(r)) selectedRarities.add(r);
    for (const t of types) if (!prevTypes.has(t)) selectedTypes.add(t);
  });

  // Called synchronously during setup (not inside the async load()), so this watcher
  // is properly tied to the component's effect scope. Gated on readyToPersist so
  // nothing writes to localStorage mid-load before selections have settled.
  watch(filterPayload, (payload) => {
    if (!readyToPersist) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // storage full/blocked (e.g. private browsing) — filters just won't persist
    }
  });

  return {
    setCode: SET_CODE,
    graph,
    loadError,
    loading,
    dataWarning,
    load,
    // Scope edits (PRD 01) — add/remove a single card on top of the bulk
    // `load()`-fetched pool; see the `graph` computed above for how these
    // combine with it (and with Deck) at render time.
    addCardToScope,
    removeCardFromScope,
    // PRD 04 "List view" — real Scope membership (distinct from the
    // Scope∪Deck union `graph` itself), so a list row can tell whether ITS
    // own add/remove-from-scope control should read "in scope" or not.
    scopeCardIds,
    // Deck (PRD 01) — a fully independent, unconstrained collection; see
    // app/types.ts's own Deck/DeckEntry doc comment.
    deck,
    addCardToDeck,
    setDeckEntryQuantity,
    removeDeckEntry,
    renameDeck,
    clearDeck,
    importDeckFromText,
    selectedColors,
    selectedRarities,
    selectedTypes,
    selectedKeywords,
    showSynergyEdges,
    relationHubsEnabled,
    relationHubThreshold,
    cardSelection,
    toggleCardSelection,
    // Card peek panel (PRD 02) — see this file's own section comment above.
    panelCardKey,
    openCardPanel,
    closeCardPanel,
    availableRarities,
    availableTypes,
    resetFilters,
    searchQuery,
    panelOpen,
    legendOpen,
    physicsOpen,
    cardCharge,
    gravity,
    linkStrength,
    linkDistanceScale,
    collidePadding,
    alphaDecay,
    velocityDecay,
    sourceNormBudget,
    sinkNormBudget,
    qtyBoost,
    gravityMode,
    resetForces,
    rerenderTrigger,
    rerenderLayout,
    hovered,
    mouseX,
    mouseY,
    functionalModelTab,
    showParserFacts,
    showTypeDerivedFacts,
    showAiFacts,
    // PRD 04 "List view" — Graph/List renderer toggle (AppHeader.vue).
    viewMode,
    // CardPeekPanel.vue's own drag-to-resize width.
    panelWidth,
  };
}

export type Store = ReturnType<typeof useGraphStore>;

// AppHeader.vue's Share button: the inverse of the restore block near the
// top of this file — reads whichever query mode is currently active
// straight off the URL, plus the live filter/search/Deck state off `store`,
// and encodes all of it as one `?share=` param. Deliberately re-reads the
// URL rather than trusting `scryfallQuery` (a module-scope const, frozen at
// whatever it was on THIS load) — not that it'd differ in practice (nothing
// in this file changes it after load), but this keeps "what gets shared"
// honestly sourced from the same place a fresh page load would re-derive it
// from, not from a value that merely happened to match at import time.
//
// Deck content rides along independently of `mode` (see ShareState's own
// comment) — serialized as a plain decklist-shaped string
// (`${quantity} ${name}` per line, deckImport.ts's own parseable grammar)
// straight off the LIVE store, not localStorage, since `store.deck` is
// already the reactive, up-to-date source of truth.
export function buildShareUrl(store: Store): string {
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const sf = params?.get('sf') ?? null;

  const deckEntries = store.deck.value.entries;
  const deckText = deckEntries.length ? deckEntries.map((e) => `${e.quantity} ${e.card.name}`).join('\n') : undefined;

  const shared: Omit<ShareState, 'mode' | 'query' | 'deckText'> = {
    colors: [...store.selectedColors],
    rarities: [...store.selectedRarities],
    types: [...store.selectedTypes],
    search: store.searchQuery.value || undefined,
  };
  const state: ShareState = sf ? { mode: 'query', query: sf, deckText, ...shared } : { mode: 'fin', deckText, ...shared };

  const out = new URLSearchParams();
  out.set('share_mode', state.mode);
  if (state.query) out.set('share_query', state.query);
  if (state.deckText) out.set('share_deck', state.deckText);
  if (state.colors?.length) out.set('share_colors', state.colors.join(','));
  if (state.rarities?.length) out.set('share_rarities', state.rarities.join(','));
  if (state.types?.length) out.set('share_types', state.types.join(','));
  if (state.search) out.set('share_search', state.search);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/app?${out.toString()}`;
}

// Symbol.for (global registry), not a plain Symbol() — this module isn't a
// Vue SFC, so it has no HMR accept boundary of its own: editing anything it
// transitively imports (e.g. graphRenderer.ts, for DEFAULT_FORCES/ForceConfig
// above) makes Vite re-execute this whole module. A plain `Symbol('store')`
// would mint a NEW, unequal symbol identity on every such re-execution — the
// already-mounted provider up the tree keeps providing the OLD identity, so
// inject(StoreKey) in any component that re-renders after the reload finds
// nothing, returns undefined, and the app crashes dark. Symbol.for looks up
// the same registry entry by string every time, so identity survives the
// module re-executing.
export const StoreKey: InjectionKey<Store> = Symbol.for('mtg-visualizer-store');
