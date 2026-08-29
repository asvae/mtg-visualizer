import { reactive, ref, shallowRef, watch, type InjectionKey } from 'vue';
import type { CardData, GraphFile, Modifier, Role, ThemeData } from './types';
import { COLOR_ORDER, RARITY_ORDER } from './lib/constants';
import { availableRarities as computeAvailableRarities, availableTypes as computeAvailableTypes } from './lib/filters';
import { DEFAULT_FORCES, type ForceConfig } from './lib/graphRenderer';

const SET_CODE = 'fin';
const STORAGE_KEY = `mtg-visualizer-filters-${SET_CODE}`;
const FORCES_STORAGE_KEY = `mtg-visualizer-forces-${SET_CODE}`;
const SEARCH_STORAGE_KEY = `mtg-visualizer-search-${SET_CODE}`;

interface SavedFilters {
  colors: string[];
  rarities: string[];
  types: string[];
  themes: string[];
}

function loadSavedFilters(): SavedFilters | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null; // corrupt/blocked storage — fall back to defaults, never throw
  }
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
  themeEdges: { themeId: string; role: Role; modifiers: Modifier[] }[];
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
  function selectAllThemes() {
    selectedThemes.clear();
    graph.value?.themes.forEach((t) => selectedThemes.add(t.id));
  }

  function resetFilters() {
    selectAllColors();
    selectAllRarities();
    selectAllTypes();
    selectAllThemes();
  }

  function applySavedFilters(data: GraphFile, rarities: string[], types: string[]) {
    const saved = loadSavedFilters();
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

    const validThemeIds = new Set(data.themes.map((t) => t.id));
    selectedThemes.clear();
    saved.themes.filter((id) => validThemeIds.has(id)).forEach((id) => selectedThemes.add(id));

    return true;
  }

  async function load() {
    try {
      const res = await fetch(`/${SET_CODE}_graph.json`);
      const data: GraphFile = await res.json();
      graph.value = data;

      const rarities = computeAvailableRarities(data, RARITY_ORDER);
      const types = computeAvailableTypes(data);
      availableRarities.value = rarities;
      availableTypes.value = types;

      if (!applySavedFilters(data, rarities, types)) {
        // No saved filters (first visit) — default to everything selected.
        selectAllColors();
        rarities.forEach((r) => selectedRarities.add(r));
        types.forEach((t) => selectedTypes.add(t));
        data.themes.forEach((t) => selectedThemes.add(t.id));
      }
      readyToPersist = true;
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
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch {
        // storage full/blocked (e.g. private browsing) — filters just won't persist
      }
    }
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
    availableRarities,
    availableTypes,
    resetFilters,
    searchQuery,
    panelOpen,
    legendOpen,
    physicsOpen,
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
