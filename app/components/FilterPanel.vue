<script setup lang="ts">
import { inject, computed, reactive } from 'vue';
import { StoreKey } from '../composables/useGraphStore';
import { COLOR_ORDER, COLOR_LABEL, COLORLESS, COLOR_MAP, RARITY_COLOR } from '../lib/constants';
import { computeFacetCounts, passesAttrFilters, availableKeywords } from '../lib/filters';

const store = inject(StoreKey)!;

const open = reactive({ colors: true, rarity: true, type: true, edges: true });

const attrFilters = computed(() => ({
  selectedColors: store.selectedColors,
  selectedRarities: store.selectedRarities,
  selectedTypes: store.selectedTypes,
}));

// Faceted counts: each option's number reflects every OTHER filter axis at its
// current selection, with this axis itself ignored — so toggling a color never
// moves that color's own count, only the other axes' counts (and vice versa).
const facetCounts = computed(() => {
  if (!store.graph.value) return { colors: {}, rarities: {}, types: {}, keywords: {} };
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

// Unlike every other checklist here, checking a keyword does NOT hide/show
// cards — it spawns a synthetic "keyword hub" node in the graph (see
// graphRenderer.ts's keyword-hub force) that every card with that keyword
// gets pulled toward, and unchecking it removes the hub again. `count` here
// is informational only (how many of the currently color/rarity/type-visible
// cards carry it), not a faceted "would still match" number the way Colors/
// Rarity/Type's counts are — see computeFacetCounts' own comment.
// Not sourced from a store.availableX ref (unlike rarity/type above) — nothing
// else needs "every keyword this corpus has" outside this one checklist, so a
// plain computed off the live graph is enough; see selectedKeywords' own
// comment in useGraphStore.ts for why there's no "select all keywords" default
// to seed from a store ref in the first place.
// availableKeywords() itself is already the right "does this exist at all"
// base set — it scans the WHOLE current corpus (`graph.cards`, every card
// this set/query/deck has, before ANY filter axis), same as
// availableRarities/availableTypes above. It deliberately does NOT react to
// Source-Sink (an edge-level toggle that never touches which CARDS exist) —
// gating keyword availability on that would make rows flicker in/out as
// someone toggles an unrelated edge filter, which is confusing and has
// nothing to do with "does this keyword exist here."
//
// What DOES get filtered out here is a row whose live count (facetCounts,
// which — like the other three axes' own counts — respects the CURRENT
// Colors/Rarity/Type selection) has dropped to zero: e.g. checking only
// Black removes every Flying card from view, so showing a "Flying: 0" row
// would just be clutter. A keyword the user already has CHECKED is kept
// visible regardless of its count reaching zero, though — hiding a checked
// row would strand it: `store.selectedKeywords` (and therefore its hub)
// stays set with no visible checkbox left to uncheck it from until the
// color/rarity/type selection changes back or Reset Filters is used.
const keywordItems = computed(() => {
  if (!store.graph.value) return [];
  return availableKeywords(store.graph.value)
    .map((k) => ({ id: k, label: k, count: facetCounts.value.keywords[k] ?? 0 }))
    .filter((item) => item.count > 0 || store.selectedKeywords.has(item.id));
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
        class="mb-1.5 -mx-1.5 flex w-full items-center gap-1.5 rounded-md p-1.5 text-[11px] font-semibold tracking-wide text-muted uppercase hover:bg-surface/50 hover:text-text"
      >
        <UIcon name="i-lucide-chevron-right" class="size-3.5 shrink-0 transition-transform" :class="{ 'rotate-90': open[s.key] }" />
        {{ s.label }}
      </button>
      <template #content>
        <ChecklistSection :items="s.items.value" :selected="s.selected.value" />
      </template>
    </UCollapsible>

    <UCollapsible v-model:open="open.edges" class="mb-2.5 pb-2.5">
      <button
        class="mb-1.5 -mx-1.5 flex w-full items-center gap-1.5 rounded-md p-1.5 text-[11px] font-semibold tracking-wide text-muted uppercase hover:bg-surface/50 hover:text-text"
      >
        <UIcon name="i-lucide-chevron-right" class="size-3.5 shrink-0 transition-transform" :class="{ 'rotate-90': open.edges }" />
        Edges
      </button>
      <template #content>
        <!-- Plain checkbox, not a ChecklistSection item — this is a single
             topology-based toggle (source-node/target-node in/out degree
             across the WHOLE graph, see filters.ts's isSourceSinkReason),
             not one more option in an attribute checklist. -->
        <UCheckbox
          v-model="store.showSourceSinkOnly.value"
          class="mb-2.5 w-full py-1"
          :ui="{ label: 'flex w-full items-center gap-1.5 text-xs' }"
        >
          <template #label>
            <span class="truncate">Show Source-Sink connections</span>
          </template>
        </UCheckbox>

        <div class="mb-0.5 text-[11px] font-semibold tracking-wide text-muted uppercase">Keywords</div>
        <div class="mb-1.5 text-[10px] text-muted">Checking one adds a hub node that pulls its cards in.</div>
        <ChecklistSection :items="keywordItems" :selected="store.selectedKeywords" />
      </template>
    </UCollapsible>
  </aside>
</template>
