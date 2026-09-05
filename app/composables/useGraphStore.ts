import { computed, reactive, ref, shallowRef, watch, type InjectionKey } from 'vue';
import type { CardData, GraphFile, GraphReason } from '../types';
import { COLOR_ORDER, RARITY_ORDER } from '../lib/constants';
import { availableRarities as computeAvailableRarities, availableTypes as computeAvailableTypes } from '../lib/filters';
import { DEFAULT_FORCES, type ForceConfig } from '../lib/graphRenderer';
import { buildGraph, type NameLink, type ScryfallCard, type TokensById } from '../lib/buildGraph';
import { parseDecklist, type ParsedDeckCard } from '../lib/deckImport';

// "sf" (scryfall filter) URL param — an arbitrary Scryfall search query,
// read once on load to switch into query mode (see load() below). Read raw
// here (module scope, not via readUrlParam below) since a query is a single
// string, not a comma-split list. This and the one-way colors/rarities/types
// read (readUrlParam below) are the only URL reads in this file — nothing
// here ever writes back to the URL; see readUrlParam's own comment.
const scryfallQuery = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('sf') : null;

// Deck mode has no URL flag at all — unlike `sf` (real, shareable query
// content), "am I in deck mode" is pure UI state with nothing worth putting
// in an address bar, so it's a sticky localStorage bit instead: it stays set
// across a plain `/app` visit or refresh until AppHeader.vue's "Clear
// filter" explicitly clears it, rather than resetting the moment the URL
// doesn't repeat a flag. Only one active deck import at a time — unlike
// `sf`'s own per-query storage bucket, a fresh paste always overwrites the
// previous one rather than accumulating buckets nothing will revisit.
export const DECK_TEXT_STORAGE_KEY = 'mtg-visualizer-deck-import-text';
export const DECK_ACTIVE_KEY = 'mtg-visualizer-deck-active';
function readDeckActive(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(DECK_ACTIVE_KEY) === '1';
  } catch {
    return false;
  }
}
// An explicit `sf=` URL always wins over a lingering deck-active flag — a
// real link you just followed is a more deliberate statement of intent than
// whatever mode a previous visit left switched on.
const deckImportActive = scryfallQuery === null && readDeckActive();
// Namespaces every distinct query (or the deck import) into its own storage
// bucket instead of clobbering the main "fin" explorer's saved filters, or
// having every query share one "query" bucket and stomp on each other's saved
// state.
const SET_CODE = deckImportActive ? 'deck' : scryfallQuery ? `q:${scryfallQuery}` : 'fin';

// Whatever decklist is currently pasted, regardless of whether it's also
// the active GLOBAL filter (see getActiveDeckCards below) — the "Global
// filter by deck" checkbox in AppHeader.vue's Import tab decides that part
// separately. This is the one used for qty badges (main graph nodes via
// stampKnownQty below, and the card detail page's own ×N badge): a pasted
// deck stays "known" for that purpose even while just browsing the normal
// set/query with it left unchecked. `null` whenever nothing's pasted,
// never an empty array (an empty deck isn't a thing `load()` below lets
// through either — see its own "No cards recognized" error).
export function getKnownDeckCards(): ParsedDeckCard[] | null {
  try {
    const text = localStorage.getItem(DECK_TEXT_STORAGE_KEY) ?? '';
    const parsed = parseDecklist(text);
    return parsed.length ? parsed : null;
  } catch {
    return null;
  }
}

// Gated to only when the pasted deck is ALSO the active global filter (the
// checkbox above was checked at import time, persisted via DECK_ACTIVE_KEY)
// — used by load()'s own mode decision (SET_CODE/raw source below) and
// getActiveFilterMode()'s Previous/Next scoping, both of which are
// specifically about "the whole app shows only these cards," not "this
// deck happens to be known." Shared with the card-detail page
// (server/api/card/[set]/[number].ts's optional `deckNames` scoping) so
// both places can't drift on what counts as "active."
export function getActiveDeckCards(): ParsedDeckCard[] | null {
  return deckImportActive ? getKnownDeckCards() : null;
}

// Query mode's own sticky breadcrumb — unlike `sf` itself (real, shareable
// URL content, read fresh above), a query-mode session otherwise has NO way
// to signal itself outside that URL param. That's fine for the main graph
// page (it re-reads `sf` every load anyway) but breaks the standalone card
// detail page below: GraphCanvas.vue opens it via `window.open` with a bare
// `/app/card/<set>/<number>` URL, no query string carried over, so without
// this it has no way to even know a query filter is active elsewhere, let
// alone what it was. AppHeader.vue writes/clears this right alongside
// DECK_ACTIVE_KEY (see submitScryfallQuery/submitDeckImport) — same sticky,
// explicit-clear-only contract DECK_ACTIVE_KEY already has, not auto-cleared
// by a bare `/app` visit either.
export const QUERY_ACTIVE_KEY = 'mtg-visualizer-active-query';

export type ActiveFilter = { mode: 'deck'; cards: { name: string; qty: number }[] } | { mode: 'query'; query: string } | null;

// Single source of truth for "is a global card filter active right now, and
// what defines it" — read by the standalone card detail page to scope its
// own Previous/Next to whichever filter's card list, since that page has no
// access to the main graph's own already-loaded `store.graph.value.cards`
// (a deliberately standalone route — see that page's own header comment).
// Deck wins if both were somehow set at once (shouldn't happen — the two
// AppHeader.vue submit functions keep them mutually exclusive) since it's
// the more specific commitment of the two.
export function getActiveFilterMode(): ActiveFilter {
  const deck = getActiveDeckCards();
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

interface SavedFilters {
  colors: string[];
  rarities: string[];
  types: string[];
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
  const graph = shallowRef<GraphFile | null>(null);
  const loadError = ref<string | null>(null);
  // True from just before load()'s first fetch until it settles (success or
  // error) — App.vue shows a loading overlay while this is true. Starts true
  // (not false) so the overlay is up from first paint, not just after
  // onMounted() calls load() a tick later.
  const loading = ref(true);
  // Non-blocking, distinct from loadError: the graph still loaded fine, this
  // just says the "sf" query matched more cards than /api/cards will return,
  // or (deck-import mode) that some pasted card names weren't found.
  const dataWarning = ref<string | null>(null);

  const selectedColors = reactive(new Set<string>());
  const selectedRarities = reactive(new Set<string>());
  const selectedTypes = reactive(new Set<string>());

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
  const reviewSessionOpen = ref(false);

  // Set by the review panel to whichever card it's currently showing — GraphCanvas
  // watches this and highlights that card on the graph, same mechanism search
  // uses. Ephemeral (not persisted): null whenever nothing's under review.
  const lookupHighlightCardId = ref<string | null>(null);

  // Restored synchronously (no graph/network dependency, unlike the filter Sets),
  // so sliders reflect the saved values from the very first render.
  const savedForces = loadSavedForces();
  const cardCharge = ref(savedForces?.cardCharge ?? DEFAULT_FORCES.cardCharge);
  const gravity = ref(savedForces?.gravity ?? DEFAULT_FORCES.gravity);
  const linkStrength = ref(savedForces?.linkStrength ?? DEFAULT_FORCES.linkStrength);
  const alphaDecay = ref(savedForces?.alphaDecay ?? DEFAULT_FORCES.alphaDecay);
  const velocityDecay = ref(savedForces?.velocityDecay ?? DEFAULT_FORCES.velocityDecay);
  // collidePadding/linkDistanceScale are no longer user-tunable (sliders removed) —
  // fixed at their DEFAULT_FORCES value regardless of what an older save might
  // have, never read from/written to storage.
  const linkDistanceScale = ref(DEFAULT_FORCES.linkDistanceScale);
  const collidePadding = ref(DEFAULT_FORCES.collidePadding);

  function resetForces() {
    cardCharge.value = DEFAULT_FORCES.cardCharge;
    gravity.value = DEFAULT_FORCES.gravity;
    linkStrength.value = DEFAULT_FORCES.linkStrength;
    alphaDecay.value = DEFAULT_FORCES.alphaDecay;
    velocityDecay.value = DEFAULT_FORCES.velocityDecay;
  }

  // Bumped by the "Rerender" button — GraphCanvas watches this and rebuilds the
  // whole layout from scratch (every node's position cleared, simulation restarted
  // at full alpha), for when the graph settled into a bad/clumped-up local layout
  // and tweaking force sliders alone won't shake it loose.
  const rerenderTrigger = ref(0);
  function rerenderLayout() {
    rerenderTrigger.value++;
  }

  watch([cardCharge, gravity, linkStrength, alphaDecay, velocityDecay], () => {
    const payload: Pick<ForceConfig, 'cardCharge' | 'gravity' | 'linkStrength' | 'alphaDecay' | 'velocityDecay'> = {
      cardCharge: cardCharge.value,
      gravity: gravity.value,
      linkStrength: linkStrength.value,
      alphaDecay: alphaDecay.value,
      velocityDecay: velocityDecay.value,
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
  }));

  function applySavedFilters(data: GraphFile, rarities: string[], types: string[]) {
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

    return true;
  }

  // Stamps client-side-only qty onto matching raw cards from whatever deck
  // is currently KNOWN (see getKnownDeckCards above) — applied uniformly
  // across all three load() branches below, regardless of which one is
  // active, so the ×N badge shows up on a pasted deck's cards even while
  // just browsing the normal set/query with "Global filter by deck" left
  // unchecked. A no-op (returns `cards` untouched) whenever nothing's
  // pasted. A DFC's own top-level name is both faces joined by " // ", so a
  // decklist naming just the front face falls back to checking each face's
  // own name, same as server/api/card/[set]/[number].ts's
  // resolveFinCardMeta already does for its own (unrelated) purpose.
  function stampKnownQty(cards: ScryfallCard[]): ScryfallCard[] {
    const known = getKnownDeckCards();
    if (!known) return cards;
    const qtyByName = new Map(known.map((c) => [c.name, c.qty]));
    return cards.map((c) => {
      const face = c.card_faces?.find((f) => f.name && qtyByName.has(f.name));
      const qty = qtyByName.get(c.name) ?? (face ? qtyByName.get(face.name!) : undefined);
      return qty != null ? { ...c, qty } : c;
    });
  }

  async function load() {
    loading.value = true;
    try {
      // Raw pieces only — no pre-built graph file. The visualizer assembles
      // cards/links itself (see app/lib/buildGraph.ts); tokens are optional (a
      // missing fetch:tokens run just means no hover images, not a load failure).
      let raw: ScryfallCard[];
      let links: NameLink[];
      let tokensById: TokensById;
      if (deckImportActive) {
        // Deck-import mode: the pasted decklist text (written by AppHeader.vue
        // right before it navigated here) is the source of truth, not the URL —
        // parse it fresh on every load so an edited/re-pasted deck under the
        // same `?deck=1` flag always reflects what's actually in storage right
        // now. No synergy links (same reasoning as query mode below) and no
        // token hover art (this endpoint doesn't fetch token images either).
        const parsed = getActiveDeckCards();
        if (!parsed) {
          loadError.value = 'No cards recognized in the pasted decklist.';
          return;
        }
        const res = await fetch('/api/cards/by-names', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ names: [...new Set(parsed.map((c) => c.name))] }),
        });
        const body = await res.json();
        if (!res.ok) {
          loadError.value = body.error || `deck import failed (${res.status})`;
          return;
        }
        // Quantity is client-side-only — the server never sees it (see
        // server/api/cards/by-names.ts's own header comment) — merged back
        // in via the same stampKnownQty every other branch uses below.
        raw = stampKnownQty(body.cards as ScryfallCard[]);
        links = [];
        tokensById = {};
        dataWarning.value = body.unmatched?.length
          ? `${body.unmatched.length} card${body.unmatched.length === 1 ? '' : 's'} not found: ${body.unmatched.join(', ')}`
          : null;
      } else if (scryfallQuery !== null) {
        // Query mode: resolve against the Netlify function instead of the
        // static per-set files — see netlify/functions/cards.mts. No token
        // images in this mode (function doesn't fetch them), so no hover art.
        // functional-model only covers FIN right now, so an arbitrary Scryfall
        // query gets no synergy links — cards render with no connections.
        const res = await fetch('/api/cards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ q: scryfallQuery }),
        });
        const body = await res.json();
        if (!res.ok) {
          loadError.value = body.error || `query failed (${res.status})`;
          return;
        }
        raw = stampKnownQty(body.cards);
        links = [];
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
        raw = stampKnownQty(raw);
      }
      const data: GraphFile = buildGraph(SET_CODE, raw, tokensById, links);
      graph.value = data;

      const rarities = computeAvailableRarities(data, RARITY_ORDER);
      const types = computeAvailableTypes(data);
      availableRarities.value = rarities;
      availableTypes.value = types;

      if (!applySavedFilters(data, rarities, types)) {
        // No saved filters (first visit) — default to every color/rarity/type.
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
    selectedColors,
    selectedRarities,
    selectedTypes,
    cardSelection,
    toggleCardSelection,
    availableRarities,
    availableTypes,
    resetFilters,
    searchQuery,
    panelOpen,
    legendOpen,
    physicsOpen,
    reviewSessionOpen,
    lookupHighlightCardId,
    cardCharge,
    gravity,
    linkStrength,
    linkDistanceScale,
    collidePadding,
    alphaDecay,
    velocityDecay,
    resetForces,
    rerenderTrigger,
    rerenderLayout,
    hovered,
    mouseX,
    mouseY,
  };
}

export type Store = ReturnType<typeof useGraphStore>;
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
