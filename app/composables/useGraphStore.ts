import { computed, reactive, ref, shallowRef, watch, type InjectionKey } from 'vue';
import type { CardData, GraphFile, Role, ThemeData } from '../types';
import { COLOR_ORDER, RARITY_ORDER } from '../lib/constants';
import { availableRarities as computeAvailableRarities, availableTypes as computeAvailableTypes, computeWeakThemeIds } from '../lib/filters';
import { DEFAULT_FORCES, type ForceConfig } from '../lib/graphRenderer';
import { buildGraph, type RelationsEntry, type ScryfallCard, type TokensById } from '../lib/buildGraph';

// "sf" (scryfall filter) URL param — the "scryfall filter" leg of the 3-part
// URL scheme (internal filter = colors/rarities/types/themes, selection =
// focus/card, both already existing). Read raw here (module scope, not via
// readUrlParam below) since a Scryfall query is a single string, not a
// comma-split list. When present, load() resolves it against /api/cards
// instead of the static per-set files — see load() below.
const scryfallQuery = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('sf') : null;
// Namespaces every distinct query into its own storage bucket instead of
// clobbering the main "fin" explorer's saved filters, or having every query
// share one "query" bucket and stomp on each other's saved state.
const SET_CODE = scryfallQuery ? `q:${scryfallQuery}` : 'fin';
const STORAGE_KEY = `mtg-visualizer-filters-${SET_CODE}`;
const FORCES_STORAGE_KEY = `mtg-visualizer-forces-${SET_CODE}`;
const SEARCH_STORAGE_KEY = `mtg-visualizer-search-${SET_CODE}`;

interface SavedFilters {
  colors: string[];
  rarities: string[];
  types: string[];
  themes: string[];
  // Every theme id that existed at save time — lets a restore tell "explicitly
  // unchecked" apart from "didn't exist yet" for themes not in `themes` above.
  // Optional so filters saved before this field existed don't crash on load.
  knownThemeIds?: string[];
}

function loadSavedFilters(): SavedFilters | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null; // corrupt/blocked storage — fall back to defaults, never throw
  }
}

// Two-way URL query sync for the attribute/theme filters and the clicked-theme
// selection — deliberately NOT search (search stays localStorage-only, see
// searchQuery below). Merges into whatever's already in the URL rather than
// replacing it wholesale, so the two watchers below (filters, theme selection)
// never clobber each other's keys, and any unrelated param a host page adds
// survives untouched. `replaceState`, not `pushState` — every filter tweak
// shouldn't spam the browser's back-button history.
// A null value deletes that param instead of setting it — used to omit a
// filter category entirely from the URL when it matches its own default (see
// isFullSelection below), so e.g. "Reset filters" produces an empty query
// string instead of one that spells out every id.
function updateUrlParams(updates: Record<string, string | null>) {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  for (const [key, value] of Object.entries(updates)) {
    if (value === null) params.delete(key);
    else params.set(key, value);
  }
  const newUrl = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
  window.history.replaceState(window.history.state, '', newUrl);
}

function isFullSelection(selected: Set<string>, full: string[]): boolean {
  return selected.size === full.length && full.every((id) => selected.has(id));
}

function readUrlParam(key: string): string[] | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  if (!params.has(key)) return null;
  const raw = params.get(key)!;
  return raw ? raw.split(',') : [];
}

function loadSavedForces(): Partial<ForceConfig> | null {
  try {
    const raw = localStorage.getItem(FORCES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export interface HoveredCard {
  kind: 'card';
  card: CardData;
  themeEdges: { themeId: string; role: Role; weight: number }[];
}
export interface HoveredTheme {
  kind: 'theme';
  theme: ThemeData & { roleCounts: Record<Role, number> };
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
  // just says the "sf" query matched more cards than /api/cards will return.
  const dataWarning = ref<string | null>(null);

  const selectedThemes = reactive(new Set<string>());
  const selectedColors = reactive(new Set<string>());
  const selectedRarities = reactive(new Set<string>());
  const selectedTypes = reactive(new Set<string>());

  // Click-to-select highlight on theme nodes — distinct from selectedThemes above
  // (which is the sidebar visibility filter). This is ephemeral exploration state,
  // not persisted, and compounds with search in the graph's highlight/dim pass.
  const themeSelection = reactive(new Set<string>());
  function toggleThemeSelection(themeId: string, additive: boolean) {
    // Theme and card selection are one unified "selection" concept — selecting
    // either kind always clears the other, so at most one type is ever active.
    cardSelection.clear();
    if (additive) {
      if (themeSelection.has(themeId)) themeSelection.delete(themeId);
      else themeSelection.add(themeId);
      return;
    }
    if (themeSelection.size === 1 && themeSelection.has(themeId)) {
      themeSelection.clear(); // clicking the sole selected theme again deselects it
    } else {
      themeSelection.clear();
      themeSelection.add(themeId); // plain click replaces the selection
    }
  }

  // Click-to-select highlight on card nodes — same mechanics/mechanism as
  // themeSelection above (ephemeral, compounds with search/theme-selection in the
  // graph's highlight pass, mirrored to the URL below but NOT to localStorage).
  // Ctrl/Cmd-click is handled entirely in GraphCanvas.vue (opens Scryfall instead
  // of calling this at all) — never reaches here.
  const cardSelection = reactive(new Set<string>());
  function toggleCardSelection(cardId: string, additive: boolean) {
    themeSelection.clear(); // see toggleThemeSelection — one unified selection concept
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
  const themeCharge = ref(savedForces?.themeCharge ?? DEFAULT_FORCES.themeCharge);
  const cardCharge = ref(savedForces?.cardCharge ?? DEFAULT_FORCES.cardCharge);
  const gravity = ref(savedForces?.gravity ?? DEFAULT_FORCES.gravity);
  const linkStrength = ref(savedForces?.linkStrength ?? DEFAULT_FORCES.linkStrength);
  const alphaDecay = ref(savedForces?.alphaDecay ?? DEFAULT_FORCES.alphaDecay);
  const velocityDecay = ref(savedForces?.velocityDecay ?? DEFAULT_FORCES.velocityDecay);
  const anchorLinkStrength = ref(savedForces?.anchorLinkStrength ?? DEFAULT_FORCES.anchorLinkStrength);
  const anchorFreeRadius = ref(savedForces?.anchorFreeRadius ?? DEFAULT_FORCES.anchorFreeRadius);
  const anchorSpread = ref(savedForces?.anchorSpread ?? DEFAULT_FORCES.anchorSpread);
  // collidePadding/linkDistanceScale are no longer user-tunable (sliders removed) —
  // fixed at their DEFAULT_FORCES value regardless of what an older save might
  // have, never read from/written to storage.
  const linkDistanceScale = ref(DEFAULT_FORCES.linkDistanceScale);
  const collidePadding = ref(DEFAULT_FORCES.collidePadding);

  function resetForces() {
    themeCharge.value = DEFAULT_FORCES.themeCharge;
    cardCharge.value = DEFAULT_FORCES.cardCharge;
    gravity.value = DEFAULT_FORCES.gravity;
    linkStrength.value = DEFAULT_FORCES.linkStrength;
    alphaDecay.value = DEFAULT_FORCES.alphaDecay;
    velocityDecay.value = DEFAULT_FORCES.velocityDecay;
    anchorLinkStrength.value = DEFAULT_FORCES.anchorLinkStrength;
    anchorFreeRadius.value = DEFAULT_FORCES.anchorFreeRadius;
    anchorSpread.value = DEFAULT_FORCES.anchorSpread;
  }

  // Bumped by the "Rerender" button — GraphCanvas watches this and rebuilds the
  // whole layout from scratch (every node's position cleared, simulation restarted
  // at full alpha), for when the graph settled into a bad/clumped-up local layout
  // and tweaking force sliders alone won't shake it loose.
  const rerenderTrigger = ref(0);
  function rerenderLayout() {
    rerenderTrigger.value++;
  }

  watch([themeCharge, cardCharge, gravity, linkStrength, alphaDecay, velocityDecay, anchorLinkStrength, anchorFreeRadius, anchorSpread], () => {
    const payload: Pick<
      ForceConfig,
      'themeCharge' | 'cardCharge' | 'gravity' | 'linkStrength' | 'alphaDecay' | 'velocityDecay' | 'anchorLinkStrength' | 'anchorFreeRadius' | 'anchorSpread'
    > = {
      themeCharge: themeCharge.value,
      cardCharge: cardCharge.value,
      gravity: gravity.value,
      linkStrength: linkStrength.value,
      alphaDecay: alphaDecay.value,
      velocityDecay: velocityDecay.value,
      anchorLinkStrength: anchorLinkStrength.value,
      anchorFreeRadius: anchorFreeRadius.value,
      anchorSpread: anchorSpread.value,
    };
    try {
      localStorage.setItem(FORCES_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // storage full/blocked — physics settings just won't persist
    }
  });

  const hovered = shallowRef<HoveredCard | HoveredTheme | null>(null);
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
  // The default/reset theme selection is strong themes only, not literally every
  // theme — weak ones (strictly one-sided produce-only or consume-only, no real
  // two-sided synergy: see isPureOneSided) are clutter until the user explicitly
  // asks for them via the checklist's own "All" button, which still does select
  // everything (see ChecklistSection.vue's local selectAll — unaffected by this).
  // Weak/strong is computed against whatever colors/rarities/types are ALREADY
  // selected, so this only makes sense called after those three are set.
  // Judged against whatever colors/rarities/types are ALREADY selected — also
  // used by the URL-omission check below, so a shared link's "default theme
  // set" always means "default given this link's own color/rarity/type filters".
  function computeDefaultThemeIds(data: GraphFile): string[] {
    const weakThemeIds = computeWeakThemeIds(data, { selectedColors, selectedRarities, selectedTypes });
    return data.themes.filter((t) => !weakThemeIds.has(t.id)).map((t) => t.id);
  }
  function selectDefaultThemes() {
    selectedThemes.clear();
    if (!graph.value) return;
    for (const id of computeDefaultThemeIds(graph.value)) selectedThemes.add(id);
  }

  function resetFilters() {
    selectAllColors();
    selectAllRarities();
    selectAllTypes();
    selectDefaultThemes();
  }

  // Single derived snapshot of everything that mirrors into the URL — a plain
  // getter (nothing here is ever assigned to directly; components mutate the
  // underlying reactive Sets, this just reflects them) recomputed whenever any
  // dependency changes, watched once below instead of one imperative
  // updateUrlParams() call per call site. A category comes out `null` (which
  // updateUrlParams deletes rather than sets) whenever it matches its own
  // default — full colors/rarities/types, default-strong themes, no
  // focus/card selection — so "Reset filters" (or a first-ever visit)
  // produces an empty query string instead of one spelling out every id.
  const urlParamState = computed<Record<string, string | null>>(() => ({
    colors: isFullSelection(selectedColors, COLOR_ORDER) ? null : [...selectedColors].join(','),
    rarities: isFullSelection(selectedRarities, availableRarities.value) ? null : [...selectedRarities].join(','),
    types: isFullSelection(selectedTypes, availableTypes.value) ? null : [...selectedTypes].join(','),
    themes:
      graph.value && isFullSelection(selectedThemes, computeDefaultThemeIds(graph.value))
        ? null
        : [...selectedThemes].join(','),
    focus: themeSelection.size ? [...themeSelection].join(',') : null,
    card: cardSelection.size ? [...cardSelection].join(',') : null,
  }));

  function applySavedFilters(data: GraphFile, rarities: string[], types: string[]) {
    const stored = loadSavedFilters();
    // A URL query param, when present, wins over whatever's in localStorage for
    // that one key — an explicit/shared URL is a more deliberate statement of
    // intent than whatever was left over from a previous visit. A category
    // absent from BOTH the URL and localStorage means "unconstrained" (every
    // color/rarity/type, default-strong themes), not "select nothing" — a link
    // that only constrains e.g. colors+themes (the landing page's archetype
    // links) should leave rarities/types open, even for a first-time visitor
    // with no localStorage yet.
    const urlColors = readUrlParam('colors');
    const urlRarities = readUrlParam('rarities');
    const urlTypes = readUrlParam('types');
    const urlThemes = readUrlParam('themes');
    if (!stored && urlColors === null && urlRarities === null && urlTypes === null && urlThemes === null) {
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

    // Themes depend on colors/rarities/types above already being resolved
    // (computeDefaultThemeIds judges weak/strong against them).
    if (urlThemes === null && !stored?.themes) {
      selectDefaultThemes();
    } else {
      // A URL's theme list is a literal, self-contained snapshot: every theme
      // currently in the graph counts as "known" to it, so anything NOT listed
      // lands as "known but unchecked" below, not "unknown, so default it on"
      // — the bug this used to have was passing `urlThemes` itself here, which
      // made every OTHER theme look unknown and get selected anyway, silently
      // ignoring the URL's actual theme list.
      const savedThemes = urlThemes ?? stored?.themes ?? [];
      const knownThemeIds = new Set(urlThemes ? data.themes.map((t) => t.id) : (stored?.knownThemeIds ?? savedThemes));
      const savedCheckedThemeIds = new Set(savedThemes);
      selectedThemes.clear();
      for (const t of data.themes) {
        if (!knownThemeIds.has(t.id) || savedCheckedThemeIds.has(t.id)) selectedThemes.add(t.id);
      }
    }

    return true;
  }

  async function load() {
    loading.value = true;
    try {
      // Raw pieces only — no pre-built graph file. The visualizer assembles cards/
      // themes/edges itself (see src/lib/buildGraph.ts); tokens are optional (a
      // missing fetch:tokens run just means no hover images, not a load failure).
      let themes: ThemeData[];
      let raw: ScryfallCard[];
      let relations: RelationsEntry[];
      let tokensById: TokensById;
      if (scryfallQuery !== null) {
        // Query mode: resolve against the Netlify function instead of the
        // static per-set files — see netlify/functions/cards.mts. No token
        // images in this mode (function doesn't fetch them), so no hover art.
        const res = await fetch(`/api/cards?q=${encodeURIComponent(scryfallQuery)}`);
        const body = await res.json();
        if (!res.ok) {
          loadError.value = body.error || `query failed (${res.status})`;
          return;
        }
        themes = body.themes;
        raw = body.cards;
        relations = body.relations;
        tokensById = {};
        dataWarning.value = body.truncated
          ? `Showing ${body.cards.length} of ${body.totalCards} matching cards — narrow your search to see the rest.`
          : null;
      } else {
        [themes, raw, relations, tokensById] = await Promise.all([
          fetch('/global_themes.json').then((r) => r.json()),
          fetch(`/${SET_CODE}/${SET_CODE}_scryfall.json`).then((r) => r.json()),
          fetch(`/${SET_CODE}/${SET_CODE}_relations.json`).then((r) => r.json()),
          fetch(`/${SET_CODE}/${SET_CODE}_tokens_scryfall.json`).then((r) => (r.ok ? r.json() : {})),
        ]);
      }
      const data: GraphFile = buildGraph(SET_CODE, raw, tokensById, relations, themes);
      graph.value = data;

      const rarities = computeAvailableRarities(data, RARITY_ORDER);
      const types = computeAvailableTypes(data);
      availableRarities.value = rarities;
      availableTypes.value = types;

      if (!applySavedFilters(data, rarities, types)) {
        // No saved filters (first visit) — default to every color/rarity/type,
        // but only strong themes (see selectDefaultThemes above).
        selectAllColors();
        rarities.forEach((r) => selectedRarities.add(r));
        types.forEach((t) => selectedTypes.add(t));
        selectDefaultThemes();
      }

      // The clicked-theme/card highlights are URL-only (no localStorage) — a link
      // either carries them or they start empty, same as visiting fresh.
      const themeIds = new Set(data.themes.map((t) => t.id));
      for (const id of readUrlParam('focus') ?? []) {
        if (themeIds.has(id)) themeSelection.add(id);
      }
      const cardIds = new Set(data.cards.map((c) => c.id));
      for (const id of readUrlParam('card') ?? []) {
        if (cardIds.has(id)) cardSelection.add(id);
      }

      readyToPersist = true;
      // Reflects the just-resolved state back into the URL immediately, so
      // copying the address bar right after load already gives a complete,
      // shareable snapshot — not just whatever the user changes from here.
      updateUrlParams(urlParamState.value);
    } catch (err) {
      loadError.value = err instanceof Error ? err.message : String(err);
    } finally {
      loading.value = false;
    }
  }

  // Called synchronously during setup (not inside the async load()), so this watcher
  // is properly tied to the component's effect scope. One watcher for all six URL
  // keys (colors/rarities/types/themes/focus/card) — urlParamState above already
  // did the work of deciding what each one should be; this just applies it,
  // gated on readyToPersist so nothing writes to the URL/localStorage mid-load
  // before selections have settled (the tail of load() does that first sync).
  watch(urlParamState, (updates) => {
    if (!readyToPersist) return;
    const payload: SavedFilters = {
      colors: [...selectedColors],
      rarities: [...selectedRarities],
      types: [...selectedTypes],
      themes: [...selectedThemes],
      knownThemeIds: graph.value?.themes.map((t) => t.id) ?? [],
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // storage full/blocked (e.g. private browsing) — filters just won't persist
    }
    updateUrlParams(updates);
  });

  return {
    setCode: SET_CODE,
    graph,
    loadError,
    loading,
    dataWarning,
    load,
    selectedThemes,
    selectedColors,
    selectedRarities,
    selectedTypes,
    themeSelection,
    toggleThemeSelection,
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
    themeCharge,
    cardCharge,
    gravity,
    linkStrength,
    linkDistanceScale,
    collidePadding,
    alphaDecay,
    velocityDecay,
    anchorLinkStrength,
    anchorFreeRadius,
    anchorSpread,
    resetForces,
    rerenderTrigger,
    rerenderLayout,
    hovered,
    mouseX,
    mouseY,
  };
}

export type Store = ReturnType<typeof useGraphStore>;
export const StoreKey: InjectionKey<Store> = Symbol('store');
