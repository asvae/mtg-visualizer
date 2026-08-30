import { reactive, ref, shallowRef, watch, type InjectionKey } from 'vue';
import type { CardData, GraphFile, Role, ThemeData } from './types';
import { COLOR_ORDER, RARITY_ORDER } from './lib/constants';
import { availableRarities as computeAvailableRarities, availableTypes as computeAvailableTypes, computeWeakThemeIds } from './lib/filters';
import { DEFAULT_FORCES, type ForceConfig } from './lib/graphRenderer';
import { buildGraph, type RelationsEntry, type ScryfallCard, type TokensById } from './lib/buildGraph';

const SET_CODE = 'fin';
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
function updateUrlParams(updates: Record<string, string>) {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  for (const [key, value] of Object.entries(updates)) params.set(key, value);
  const newUrl = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
  window.history.replaceState(window.history.state, '', newUrl);
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
export function createStore() {
  const graph = shallowRef<GraphFile | null>(null);
  const loadError = ref<string | null>(null);

  const selectedThemes = reactive(new Set<string>());
  const selectedColors = reactive(new Set<string>());
  const selectedRarities = reactive(new Set<string>());
  const selectedTypes = reactive(new Set<string>());

  // Click-to-select highlight on theme nodes — distinct from selectedThemes above
  // (which is the sidebar visibility filter). This is ephemeral exploration state,
  // not persisted, and compounds with search in the graph's highlight/dim pass.
  const themeSelection = reactive(new Set<string>());
  function toggleThemeSelection(themeId: string, additive: boolean) {
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
  function selectDefaultThemes() {
    selectedThemes.clear();
    if (!graph.value) return;
    const weakThemeIds = computeWeakThemeIds(graph.value, { selectedColors, selectedRarities, selectedTypes });
    for (const t of graph.value.themes) {
      if (!weakThemeIds.has(t.id)) selectedThemes.add(t.id);
    }
  }

  function resetFilters() {
    selectAllColors();
    selectAllRarities();
    selectAllTypes();
    selectDefaultThemes();
  }

  function applySavedFilters(data: GraphFile, rarities: string[], types: string[]) {
    const stored = loadSavedFilters();
    // A URL query param, when present, wins over whatever's in localStorage for
    // that one key — an explicit/shared URL is a more deliberate statement of
    // intent than whatever was left over from a previous visit. Absent params
    // fall back to the stored value per-key, not all-or-nothing.
    const urlColors = readUrlParam('colors');
    const urlRarities = readUrlParam('rarities');
    const urlTypes = readUrlParam('types');
    const urlThemes = readUrlParam('themes');
    const saved: SavedFilters | null =
      stored || urlColors || urlRarities || urlTypes || urlThemes
        ? {
            colors: urlColors ?? stored?.colors ?? [],
            rarities: urlRarities ?? stored?.rarities ?? [],
            types: urlTypes ?? stored?.types ?? [],
            themes: urlThemes ?? stored?.themes ?? [],
            // A URL's theme list is a literal, self-contained snapshot: every
            // theme currently in the graph counts as "known" to it, so anything
            // NOT listed lands as "known but unchecked" below, not "unknown, so
            // default it on" — the bug this used to have was passing `urlThemes`
            // itself here, which made every OTHER theme look unknown and get
            // selected anyway, silently ignoring the URL's actual theme list.
            knownThemeIds: urlThemes ? data.themes.map((t) => t.id) : stored?.knownThemeIds,
          }
        : null;
    if (!saved) return false;

    const validColors = new Set(COLOR_ORDER);
    selectedColors.clear();
    saved.colors.filter((c) => validColors.has(c)).forEach((c) => selectedColors.add(c));

    const validRarities = new Set(rarities);
    selectedRarities.clear();
    saved.rarities.filter((r) => validRarities.has(r)).forEach((r) => selectedRarities.add(r));

    const validTypes = new Set(types);
    selectedTypes.clear();
    saved.types.filter((t) => validTypes.has(t)).forEach((t) => selectedTypes.add(t));

    // A theme not present in `saved.themes` is ambiguous on its own — explicitly
    // unchecked, or introduced since the save was made (a newly reviewed theme,
    // or one of the auto-derived creature-type themes)? `knownThemeIds` (every
    // theme id that existed at save time) resolves it: known-but-unchecked stays
    // off, but anything brand new defaults on, same as a first-ever visit — it
    // shouldn't take a manual re-check just because it didn't exist yet.
    const knownThemeIds = new Set(saved.knownThemeIds ?? saved.themes);
    const savedCheckedThemeIds = new Set(saved.themes);
    selectedThemes.clear();
    for (const t of data.themes) {
      if (!knownThemeIds.has(t.id) || savedCheckedThemeIds.has(t.id)) selectedThemes.add(t.id);
    }

    return true;
  }

  async function load() {
    try {
      // Raw pieces only — no pre-built graph file. The visualizer assembles cards/
      // themes/edges itself (see src/lib/buildGraph.ts); tokens are optional (a
      // missing fetch:tokens run just means no hover images, not a load failure).
      const [themes, raw, relations, tokensById]: [ThemeData[], ScryfallCard[], RelationsEntry[], TokensById] = await Promise.all([
        fetch('/themes.json').then((r) => r.json()),
        fetch(`/${SET_CODE}/${SET_CODE}_scryfall.json`).then((r) => r.json()),
        fetch(`/${SET_CODE}/${SET_CODE}_relations.json`).then((r) => r.json()),
        fetch(`/${SET_CODE}/${SET_CODE}_tokens_scryfall.json`).then((r) => (r.ok ? r.json() : {})),
      ]);
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
      updateUrlParams({
        colors: [...selectedColors].join(','),
        rarities: [...selectedRarities].join(','),
        types: [...selectedTypes].join(','),
        themes: [...selectedThemes].join(','),
        focus: [...themeSelection].join(','),
        card: [...cardSelection].join(','),
      });
    } catch (err) {
      loadError.value = err instanceof Error ? err.message : String(err);
    }
  }

  // Called synchronously during setup (not inside the async load()), so this watcher
  // is properly tied to the component's effect scope.
  watch(
    () => [...selectedColors, ...selectedRarities, ...selectedTypes, ...selectedThemes],
    () => {
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
      updateUrlParams({
        colors: payload.colors.join(','),
        rarities: payload.rarities.join(','),
        types: payload.types.join(','),
        themes: payload.themes.join(','),
      });
    }
  );

  // Clicked-theme/card highlights, mirrored to the URL only — not localStorage,
  // not search (see updateUrlParams above). Doesn't need the readyToPersist
  // guard: both start empty either way (nothing to accidentally clobber pre-load).
  watch(
    () => [...themeSelection],
    (ids) => updateUrlParams({ focus: ids.join(',') })
  );
  watch(
    () => [...cardSelection],
    (ids) => updateUrlParams({ card: ids.join(',') })
  );

  return {
    setCode: SET_CODE,
    graph,
    loadError,
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

export type Store = ReturnType<typeof createStore>;
export const StoreKey: InjectionKey<Store> = Symbol('store');
