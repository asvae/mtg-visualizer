<script setup lang="ts">
import { inject, computed, reactive } from 'vue';
import { StoreKey } from '../composables/useGraphStore';
import { COLOR_ORDER, COLOR_LABEL, COLORLESS, COLOR_MAP, RARITY_COLOR } from '../lib/constants';
import { computeThemeCounts, computeFacetCounts, passesAttrFilters, computeWeakThemeIds } from '../lib/filters';

const store = inject(StoreKey)!;

const open = reactive({ colors: true, rarity: true, type: true, themes: true });

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
  COLOR_ORDER.map((c) => ({ id: c, label: COLOR_LABEL[c]!, dotColor: c === 'C' ? COLORLESS : COLOR_MAP[c]!, count: facetCounts.value.colors[c] ?? 0 })).filter(
    (it) => it.count > 0
  )
);

const rarityItems = computed(() =>
  store.availableRarities.value
    .map((r) => ({
      id: r,
      label: r.charAt(0).toUpperCase() + r.slice(1),
      dotColor: RARITY_COLOR[r]!,
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

const SECTIONS = [
  { key: 'colors' as const, label: 'Colors', items: colorItems, selected: computed(() => store.selectedColors) },
  { key: 'rarity' as const, label: 'Rarity', items: rarityItems, selected: computed(() => store.selectedRarities) },
  { key: 'type' as const, label: 'Type', items: typeItems, selected: computed(() => store.selectedTypes) },
];
</script>

<template>
  <aside
    class="w-[220px] min-w-[220px] overflow-y-auto bg-panel p-2.5 transition-[margin-left] duration-150"
    :class="{ '-ml-[240px]': !store.panelOpen.value }"
  >
    <UButton block color="neutral" variant="subtle" class="mb-3 justify-center" @click="store.resetFilters()">Reset filters</UButton>
    <div class="mb-3 text-center text-[11px] text-muted">{{ matchingCards }} / {{ totalCards }} cards match filters</div>

    <UCollapsible v-for="s in SECTIONS" :key="s.key" v-model:open="open[s.key]" class="mb-2.5 border-b border-border-subtle pb-2.5">
      <button
        class="mb-1.5 -mx-1.5 flex items-center gap-1.5 rounded-md p-1.5 text-[11px] font-semibold tracking-wide text-muted uppercase hover:bg-surface/50 hover:text-text"
      >
        <UIcon name="i-lucide-chevron-right" class="transition-transform" :class="{ 'rotate-90': open[s.key] }" />
        {{ s.label }}
      </button>
      <template #content>
        <ChecklistSection :items="s.items.value" :selected="s.selected.value" />
      </template>
    </UCollapsible>

    <UCollapsible v-model:open="open.themes" class="mb-2.5 pb-2.5">
      <button
        class="mb-1.5 -mx-1.5 flex items-center gap-1.5 rounded-md p-1.5 text-[11px] font-semibold tracking-wide text-muted uppercase hover:bg-surface/50 hover:text-text"
      >
        <UIcon name="i-lucide-chevron-right" class="transition-transform" :class="{ 'rotate-90': open.themes }" />
        Themes
      </button>
      <template #content>
        <ChecklistSection :items="themeItems" :selected="store.selectedThemes" :show-all-none="true" :themed="true" />
      </template>
    </UCollapsible>
  </aside>
</template>
