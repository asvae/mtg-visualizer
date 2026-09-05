<script setup lang="ts">
import { inject, computed, reactive } from 'vue';
import { StoreKey } from '../composables/useGraphStore';
import { COLOR_ORDER, COLOR_LABEL, COLORLESS, COLOR_MAP, RARITY_COLOR } from '../lib/constants';
import { computeFacetCounts, passesAttrFilters } from '../lib/filters';

const store = inject(StoreKey)!;

const open = reactive({ colors: true, rarity: true, type: true });

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
  return computeFacetCounts(store.graph.value, attrFilters.value);
});

// Every option always shows — the list itself is static (every color/rarity/type
// that exists anywhere in this set), only the live count next to each one moves
// with the other axes' current selection. Hiding zero-count options used to make
// "All"/bulk-select silently unable to re-select them (ChecklistSection's All only
// ever operates on the `items` it's handed) and made a reset that legitimately
// zeroes another axis look like data vanished instead of "nothing matches right now".
const colorItems = computed(() =>
  COLOR_ORDER.map((c) => ({ id: c, label: COLOR_LABEL[c]!, dotColor: c === 'C' ? COLORLESS : COLOR_MAP[c]!, count: facetCounts.value.colors[c] ?? 0 }))
);

const rarityItems = computed(() =>
  store.availableRarities.value.map((r) => ({
    id: r,
    label: r.charAt(0).toUpperCase() + r.slice(1),
    dotColor: RARITY_COLOR[r]!,
    count: facetCounts.value.rarities[r] ?? 0,
  }))
);

const typeItems = computed(() => store.availableTypes.value.map((t) => ({ id: t, label: t, count: facetCounts.value.types[t] ?? 0 })));

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
        class="mb-1.5 -mx-1.5 flex w-full items-center gap-1.5 rounded-md p-1.5 text-[11px] font-semibold tracking-wide text-muted uppercase hover:bg-surface/50 hover:text-text"
      >
        <UIcon name="i-lucide-chevron-right" class="size-3.5 shrink-0 transition-transform" :class="{ 'rotate-90': open[s.key] }" />
        {{ s.label }}
      </button>
      <template #content>
        <ChecklistSection :items="s.items.value" :selected="s.selected.value" />
      </template>
    </UCollapsible>
  </aside>
</template>
