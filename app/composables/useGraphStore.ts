import { computed, onMounted, reactive, ref, shallowRef, watch, type InjectionKey } from 'vue';
import type { CardData, GraphFile, GraphReason } from '../types';
import { COLOR_ORDER, RARITY_ORDER } from '../lib/constants';
import {
  availableRarities as computeAvailableRarities,
  availableTypes as computeAvailableTypes,
  availableKeywords as computeAvailableKeywords,
} from '../lib/filters';
import { DEFAULT_FORCES, type ForceConfig, type GravityMode } from '../lib/graphRenderer';
import { buildGraph, type NameLink, type ScryfallCard, type TokensById } from '../lib/buildGraph';
import { parseDecklist, type ParsedDeckCard } from '../lib/deckImport';

// Storage keys referenced by the shareable-link restore block below, so
// declared before it rather than in their original historical order.
//
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
// Query mode's own sticky breadcrumb — see its fuller comment further down
// this file, by getActiveFilterMode. Declared here (rather than in its
// original spot) only so the shareable-link restore block below can write
// it before that comment's own read sites run.
export const QUERY_ACTIVE_KEY = 'mtg-visualizer-active-query';

// --- Shareable link restore --------------------------------------------
// AppHeader.vue's Share button (see buildShareUrl below) encodes the whole
// visualizer state — mode, query/decklist, colors/rarities/types, search —
// as plain, readable `share_*` query params (nothing secret here, no reason
// to obscure it behind a base64 blob). Restoring it has to happen here, at
// the very top of this module, BEFORE `scryfallQuery`/`deckImportActive`
// below read anything: those are computed once, straight off the
// URL/localStorage, at module-eval time — exactly like a real navigation or
// a manual paste into the filter modal would leave things, which is
// deliberately what this block produces (seeds localStorage, and for query
// mode rewrites the address bar to the same `?sf=` shape
// submitScryfallQuery already navigates to) rather than inventing a
// parallel "restored" code path elsewhere in this file. The `share_*`
// params themselves are stripped immediately after (history.replaceState,
// no reload, no history entry added) — a share link is a one-time seed, not
// something that should linger in the address bar or get re-applied on
// every future refresh of this tab.
export interface ShareState {
  mode: 'fin' | 'deck' | 'query';
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
  const mode = params.get('share_mode');
  if (mode !== 'fin' && mode !== 'deck' && mode !== 'query') return null;
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
    if (sharedState.mode === 'deck' && sharedState.deckText) {
      localStorage.setItem(DECK_TEXT_STORAGE_KEY, sharedState.deckText);
      localStorage.setItem(DECK_ACTIVE_KEY, '1');
      localStorage.removeItem(QUERY_ACTIVE_KEY);
    } else if (sharedState.mode === 'query' && sharedState.query) {
      localStorage.setItem(QUERY_ACTIVE_KEY, sharedState.query);
      localStorage.removeItem(DECK_ACTIVE_KEY);
    } else {
      localStorage.removeItem(DECK_ACTIVE_KEY);
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

// Query mode's own sticky breadcrumb (QUERY_ACTIVE_KEY, declared near the
// top of this file alongside DECK_ACTIVE_KEY) — unlike `sf` itself (real,
// shareable URL content, read fresh above), a query-mode session otherwise
// has NO way to signal itself outside that URL param. That's fine for the
// main graph page (it re-reads `sf` every load anyway) but breaks the
// standalone card detail page below: GraphCanvas.vue opens it via
// `window.open` with a bare `/app/card/<set>/<number>` URL, no query string
// carried over, so without this it has no way to even know a query filter
// is active elsewhere, let alone what it was. AppHeader.vue writes/clears
// this right alongside DECK_ACTIVE_KEY (see submitScryfallQuery/
// submitDeckImport) — same sticky, explicit-clear-only contract
// DECK_ACTIVE_KEY already has, not auto-cleared by a bare `/app` visit
// either.

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
// Separate key, not folded into FORCES_STORAGE_KEY's own JSON blob — that
// one's sanitized as a flat numeric-fields-only object (see
// loadSavedForces/NUMERIC_FORCE_KEYS below), and a non-numeric value there
// would just get silently dropped by that same guard.
const GRAVITY_MODE_STORAGE_KEY = `mtg-visualizer-gravity-mode-${SET_CODE}`;
// Not namespaced by SET_CODE — unlike the filter/force state above, "which of
// the four functional-model views you last looked at" isn't really a
// per-set preference, just a standing UI habit.
const FUNCTIONAL_MODEL_TAB_STORAGE_KEY = 'mtg-visualizer-functional-model-tab';

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
  sourceSinkOnly?: boolean;
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
    });
  }

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
  // Keywords/Source-Sink (FilterPanel.vue's "Edges" section) — unlike the
  // three axes above, both default to their neutral/off state (empty set,
  // false) rather than "everything selected": most cards carry no
  // BADGE_KEYWORDS at all, and Source-Sink is an opt-in topology view, not
  // a per-card attribute with a natural "every option" default. Persisted to
  // localStorage the same way colors/rarity/type are (see filterPayload/
  // applySavedFilters below) — NOT mirrored to the URL/share-link the way
  // colors/rarity/type optionally are, since nothing asked for that yet.
  const selectedKeywords = reactive(new Set<string>());
  const showSourceSinkOnly = ref(false);

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
  const FUNCTIONAL_MODEL_TABS = ['facts', 'scenarios', 'json', 'definition'] as const;
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
    selectedKeywords.clear();
    showSourceSinkOnly.value = false;
  }

  // Plain snapshot of the filter state that gets persisted to localStorage —
  // watched once below instead of one imperative localStorage.setItem() call
  // per filter mutation site.
  const filterPayload = computed<SavedFilters>(() => ({
    colors: [...selectedColors],
    rarities: [...selectedRarities],
    types: [...selectedTypes],
    keywords: [...selectedKeywords],
    sourceSinkOnly: showSourceSinkOnly.value,
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
    showSourceSinkOnly.value = stored?.sourceSinkOnly ?? false;

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
        // now. Real synergy links via /api/graph-links below — no token hover
        // art though (this endpoint doesn't fetch token images either).
        const parsed = getActiveDeckCards();
        if (!parsed) {
          loadError.value = 'No cards recognized in the pasted decklist.';
          return;
        }
        // graph-links is the whole functional-model pool's synergy edges,
        // fetched in parallel with the deck's own card lookup — buildGraph
        // already drops any link whose name isn't in this deck's `raw` (see
        // its own resolvedLinks loop), so no client-side filtering needed
        // here; same whole-pool-then-resolve shape the plain (no filter)
        // branch below already uses.
        const [res, linksRes] = await Promise.all([
          fetch('/api/cards/by-names', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ names: [...new Set(parsed.map((c) => c.name))] }),
          }),
          fetch('/api/graph-links'),
        ]);
        const body = await res.json();
        if (!res.ok) {
          loadError.value = body.error || `deck import failed (${res.status})`;
          return;
        }
        // Quantity is client-side-only — the server never sees it (see
        // server/api/cards/by-names.ts's own header comment) — merged back
        // in via the same stampKnownQty every other branch uses below.
        raw = stampKnownQty(body.cards as ScryfallCard[]);
        links = linksRes.ok ? ((await linksRes.json()).links as NameLink[]) : [];
        tokensById = {};
        dataWarning.value = body.unmatched?.length
          ? `${body.unmatched.length} card${body.unmatched.length === 1 ? '' : 's'} not found: ${body.unmatched.join(', ')}`
          : null;
      } else if (scryfallQuery !== null) {
        // Query mode: resolve against the Netlify function instead of the
        // static per-set files — see netlify/functions/cards.mts. No token
        // images in this mode (function doesn't fetch them), so no hover art.
        // Real synergy links via /api/graph-links, same whole-pool-then-let-
        // buildGraph-resolve shape the deck branch above uses.
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
        raw = stampKnownQty(body.cards);
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
        raw = stampKnownQty(raw);
      }
      const data: GraphFile = buildGraph(SET_CODE, raw, tokensById, links);
      graph.value = data;

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
    selectedKeywords,
    showSourceSinkOnly,
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
  };
}

export type Store = ReturnType<typeof useGraphStore>;

// AppHeader.vue's Share button: the inverse of the restore block near the
// top of this file — reads whichever mode/query/deck is currently active
// straight off the URL/localStorage (same sources that block reads from),
// plus the live filter/search state off `store`, and encodes all of it as
// one `?share=` param. Deliberately re-reads the URL/localStorage rather
// than trusting SET_CODE/scryfallQuery (module-scope consts, frozen at
// whatever they were on THIS load) — not that it'd differ in practice
// (nothing in this file changes them after load), but this keeps "what gets
// shared" honestly sourced from the same place a fresh page load would
// re-derive it from, not from a value that merely happened to match at
// import time.
export function buildShareUrl(store: Store): string {
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const sf = params?.get('sf') ?? null;
  let deckActive = false;
  let deckText = '';
  try {
    deckActive = localStorage.getItem(DECK_ACTIVE_KEY) === '1';
    deckText = deckActive ? (localStorage.getItem(DECK_TEXT_STORAGE_KEY) ?? '') : '';
  } catch {
    // storage blocked — share as plain fin/query mode, no deck
  }

  const shared: Omit<ShareState, 'mode' | 'query' | 'deckText'> = {
    colors: [...store.selectedColors],
    rarities: [...store.selectedRarities],
    types: [...store.selectedTypes],
    search: store.searchQuery.value || undefined,
  };
  const state: ShareState =
    deckActive && deckText
      ? { mode: 'deck', deckText, ...shared }
      : sf
        ? { mode: 'query', query: sf, ...shared }
        : { mode: 'fin', ...shared };

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
