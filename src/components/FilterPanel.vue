<script setup lang="ts">
import { inject, computed, reactive } from 'vue';
import { StoreKey } from '../store';
import ChecklistSection from './ChecklistSection.vue';
import { COLOR_ORDER, COLOR_LABEL, COLORLESS, COLOR_MAP, RARITY_COLOR } from '../lib/constants';
import { computeThemeCounts, computeFacetCounts, passesAttrFilters, computeWeakThemeIds } from '../lib/filters';

const store = inject(StoreKey)!;

const open = reactive({ colors: true, rarity: true, type: true, themes: true });
function toggle(section: keyof typeof open) {
  open[section] = !open[section];
}

const attrFilters = computed(() => ({
  selectedColors: store.selectedColors,
  selectedRarities: store.selectedRarities,
  selectedTypes: store.selectedTypes,
}));

// Faceted counts: each option's number reflects every OTHER filter axis at its
// current selection, with this axis itself ignored — so toggling a color never
// moves that color's own count, only the other axes' counts (and vice versa).
const facetCounts = computed(() => {
  if (!store.graph.value) return { colors: {}, rarities: {}, types: {} };
  return computeFacetCounts(store.graph.value, { ...attrFilters.value, selectedThemes: store.selectedThemes });
});

// Zero-count items are hidden (they can't match anything under the other axes'
// current selection) — the underlying selectedColors/etc. Set is untouched, so a
// hidden-but-checked item just stays checked and reappears once its count recovers.
const colorItems = computed(() =>
  COLOR_ORDER.map((c) => ({ id: c, label: COLOR_LABEL[c], dotColor: c === 'C' ? COLORLESS : COLOR_MAP[c], count: facetCounts.value.colors[c] ?? 0 })).filter(
    (it) => it.count > 0
  )
);

const rarityItems = computed(() =>
  store.availableRarities.value
    .map((r) => ({
      id: r,
      label: r.charAt(0).toUpperCase() + r.slice(1),
      dotColor: RARITY_COLOR[r],
      count: facetCounts.value.rarities[r] ?? 0,
    }))
    .filter((it) => it.count > 0)
);

const typeItems = computed(() =>
  store.availableTypes.value.map((t) => ({ id: t, label: t, count: facetCounts.value.types[t] ?? 0 })).filter((it) => it.count > 0)
);

// Reactively recomputes whenever the color/rarity/type Sets change — Vue's
// collection reactivity tracks .has()/iteration on these Sets automatically, so this
// replaces what used to be a manual DOM-patching function. Deliberately independent
// of search: filters shrink the actual collection, search only highlights within it.
// Already follows the same faceted rule by construction — a theme's own checkbox
// state never factors into its own count.
const themeCounts = computed(() => {
  if (!store.graph.value) return {} as Record<string, number>;
  return computeThemeCounts(store.graph.value, attrFilters.value);
});

const weakThemeIds = computed(() => (store.graph.value ? computeWeakThemeIds(store.graph.value, attrFilters.value) : new Set<string>()));

const themeItems = computed(() => {
  if (!store.graph.value) return [];
  return [...store.graph.value.themes]
    .map((t) => ({ id: t.id, label: t.label, count: themeCounts.value[t.id] ?? 0, weak: weakThemeIds.value.has(t.id) }))
    .filter((t) => t.count > 0)
    // Strong themes first (alphabetical within each group), weak ones after —
    // matches the "Strong" bulk-select and bold styling: the themes worth building
    // a mental model of come first, the thin/no-synergy ones trail behind.
    .sort((a, b) => Number(a.weak) - Number(b.weak) || a.label.localeCompare(b.label));
});

const totalCards = computed(() => store.graph.value?.cards.length ?? 0);
const matchingCards = computed(() => {
  if (!store.graph.value) return 0;
  return store.graph.value.cards.filter((c) => passesAttrFilters(c, attrFilters.value)).length;
});
</script>

<template>
  <aside id="theme-panel" :class="{ collapsed: !store.panelOpen.value }">
    <button id="reset-filters" @click="store.resetFilters()">Reset filters</button>
    <div class="match-count">{{ matchingCards }} / {{ totalCards }} cards match filters</div>

    <div class="filter-section">
      <h2 @click="toggle('colors')"><span class="chevron" :class="{ open: open.colors }">▸</span>Colors</h2>
      <div v-show="open.colors"><ChecklistSection :items="colorItems" :selected="store.selectedColors" /></div>
    </div>
    <div class="filter-section">
      <h2 @click="toggle('rarity')"><span class="chevron" :class="{ open: open.rarity }">▸</span>Rarity</h2>
      <div v-show="open.rarity"><ChecklistSection :items="rarityItems" :selected="store.selectedRarities" /></div>
    </div>
    <div class="filter-section">
      <h2 @click="toggle('type')"><span class="chevron" :class="{ open: open.type }">▸</span>Type</h2>
      <div v-show="open.type"><ChecklistSection :items="typeItems" :selected="store.selectedTypes" /></div>
    </div>
    <div class="filter-section">
      <h2 @click="toggle('themes')"><span class="chevron" :class="{ open: open.themes }">▸</span>Themes</h2>
      <div v-show="open.themes"><ChecklistSection :items="themeItems" :selected="store.selectedThemes" :show-all-none="true" :themed="true" /></div>
    </div>
  </aside>
</template>

<style scoped>
#theme-panel {
  width: 220px;
  min-width: 220px;
  background: var(--panel);
  border-right: 1px solid #2a2c36;
  overflow-y: auto;
  padding: 10px;
  transition: margin-left 0.15s ease;
}

#theme-panel.collapsed {
  margin-left: -240px;
}

#reset-filters {
  width: 100%;
  margin-bottom: 12px;
  padding: 6px 0;
}

#reset-filters:hover {
  background: #33364280;
}

.filter-section {
  border-bottom: 1px solid #2a2c36;
  padding-bottom: 10px;
  margin-bottom: 10px;
}

.filter-section h2 {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
  margin: -6px -6px 6px;
  padding: 6px;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  user-select: none;
}

.filter-section h2:hover {
  color: var(--text);
  background: #33364280;
}

.chevron {
  display: inline-block;
  transition: transform 0.12s ease;
  font-size: 9px;
}

.chevron.open {
  transform: rotate(90deg);
}

.match-count {
  font-size: 11px;
  color: var(--muted);
  margin-bottom: 12px;
  text-align: center;
}
</style>
