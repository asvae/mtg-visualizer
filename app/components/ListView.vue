<script setup lang="ts">
// PRD 04 "List view" (docs/prds/04-list-view.md) — a second, first-class
// renderer over the EXACT same Scope/Filter/Deck state the graph reads
// (`useGraphStore.ts`), not a separate data path: same `store.graph` (the
// Scope∪Deck union), same `store.selectedColors/Rarities/Types` filter
// state (via the same `passesAttrFilters` GraphCanvas/graphRenderer already
// use), same `store.openCardPanel` (PRD 02's peek panel), same
// `store.addCardToScope`/`removeCardFromScope`/`setDeckEntryQuantity` (PRD
// 01's Scope/Deck editing). No new filter facets, no column configurability
// — a fixed column set, sortable by name/mana value only, per the PRD's own
// non-goals.
import { computed, inject, ref } from 'vue';
import { StoreKey } from '../composables/useGraphStore';
import { passesAttrFilters, type AttrFilters } from '../lib/filters';
import { parseManaSegments } from '../lib/manaSegments';
import type { CardData, GraphFile } from '../types';

const props = defineProps<{ graph: GraphFile }>();
const store = inject(StoreKey)!;

type SortKey = 'name' | 'cmc';
const sortKey = ref<SortKey>('name');
const sortDir = ref<'asc' | 'desc'>('asc');

function toggleSort(key: SortKey) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortKey.value = key;
    sortDir.value = 'asc';
  }
}

const attrFilters = computed<AttrFilters>(() => ({
  selectedColors: store.selectedColors,
  selectedRarities: store.selectedRarities,
  selectedTypes: store.selectedTypes,
}));

// Same filtered card set the graph itself shows (GraphCanvas -> graphRenderer
// both apply this same passesAttrFilters against the identical selection) —
// this view never re-derives its own notion of "visible."
const rows = computed<CardData[]>(() => {
  const filtered = props.graph.cards.filter((c) => passesAttrFilters(c, attrFilters.value));
  const dir = sortDir.value === 'asc' ? 1 : -1;
  return [...filtered].sort((a, b) => {
    if (sortKey.value === 'cmc') return (a.cmc - b.cmc || a.name.localeCompare(b.name)) * dir;
    return a.name.localeCompare(b.name) * dir;
  });
});

function manaSegments(card: CardData) {
  return parseManaSegments(card.manaCost ?? '').filter((s): s is { mana: string } => 'mana' in s);
}

function openRow(card: CardData) {
  store.openCardPanel(card.set, card.collectorNumber);
}

// --- Per-row Deck quantity control (PRD 01 Deck editing, no cap/validation) ---
function deckQty(card: CardData): number {
  return card.qty ?? 0;
}
function setQty(card: CardData, next: number) {
  store.setDeckEntryQuantity(card.id, Math.max(0, Math.floor(next) || 0), card);
}
function onQtyInput(card: CardData, event: Event) {
  const value = Number((event.target as HTMLInputElement).value);
  setQty(card, Number.isFinite(value) ? value : 0);
}

// --- Per-row Scope control (PRD 01 Scope editing) ------------------------
// A row is always drawn from the Scope∪Deck union (`store.graph`), so it's
// either genuinely in Scope right now, or visible only via a Deck entry with
// quantity > 0 — `store.scopeCardIds` (not the union itself) is what tells
// these two apart.
function inScope(card: CardData): boolean {
  return store.scopeCardIds.value.has(card.id);
}
async function toggleScope(card: CardData) {
  if (inScope(card)) {
    store.removeCardFromScope(card.id);
    return;
  }
  // `card` is already this row's full CardData (it came from the union
  // itself) — passed as the preset so this never forces a redundant network
  // fetch for data already in hand.
  const result = await store.addCardToScope(card.set, card.collectorNumber, card);
  if (!result.ok) {
    useToast().add({ title: 'Could not add to Scope', description: result.error, color: 'error', icon: 'i-lucide-triangle-alert' });
  }
}
</script>

<template>
  <div class="flex-1 overflow-auto p-3">
    <table class="w-full border-separate border-spacing-0 text-xs">
      <thead class="sticky top-0 z-10 bg-panel">
        <tr class="text-left text-[11px] font-semibold tracking-wide text-muted uppercase">
          <th class="border-b border-border-subtle px-2 py-2">
            <button type="button" class="flex items-center gap-1 hover:text-text" @click="toggleSort('name')">
              Name
              <UIcon
                v-if="sortKey === 'name'"
                :name="sortDir === 'asc' ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
                class="size-3"
              />
            </button>
          </th>
          <th class="border-b border-border-subtle px-2 py-2">
            <button type="button" class="flex items-center gap-1 hover:text-text" @click="toggleSort('cmc')">
              Mana cost
              <UIcon
                v-if="sortKey === 'cmc'"
                :name="sortDir === 'asc' ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
                class="size-3"
              />
            </button>
          </th>
          <th class="border-b border-border-subtle px-2 py-2">Type</th>
          <th class="border-b border-border-subtle px-2 py-2">Deck qty</th>
          <th class="border-b border-border-subtle px-2 py-2">Scope</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="card in rows"
          :key="card.id"
          class="cursor-pointer text-text hover:bg-surface/60"
          @click="openRow(card)"
        >
          <td class="border-b border-border-subtle px-2 py-1.5 font-medium">{{ card.name }}</td>
          <td class="border-b border-border-subtle px-2 py-1.5 whitespace-nowrap">
            <span v-if="manaSegments(card).length" class="inline-flex items-center gap-px">
              <ManaSymbol v-for="(seg, i) in manaSegments(card)" :key="i" :code="seg.mana" />
            </span>
            <span v-else class="text-muted">—</span>
          </td>
          <td class="border-b border-border-subtle px-2 py-1.5 text-muted">{{ card.typeLine }}</td>
          <td class="border-b border-border-subtle px-2 py-1.5" @click.stop>
            <div class="flex items-center gap-1">
              <UButton
                icon="i-lucide-minus"
                color="neutral"
                variant="subtle"
                size="xs"
                square
                :aria-label="`Remove one ${card.name} from deck`"
                @click="setQty(card, deckQty(card) - 1)"
              />
              <input
                type="number"
                min="0"
                :value="deckQty(card)"
                class="w-12 rounded border border-border-subtle bg-surface px-1 py-0.5 text-center text-[11px] text-text"
                :aria-label="`${card.name} deck quantity`"
                @change="onQtyInput(card, $event)"
              />
              <UButton
                icon="i-lucide-plus"
                color="neutral"
                variant="subtle"
                size="xs"
                square
                :aria-label="`Add one ${card.name} to deck`"
                @click="setQty(card, deckQty(card) + 1)"
              />
            </div>
          </td>
          <td class="border-b border-border-subtle px-2 py-1.5" @click.stop>
            <UButton
              :icon="inScope(card) ? 'i-lucide-minus' : 'i-lucide-plus'"
              :color="inScope(card) ? 'neutral' : 'primary'"
              variant="subtle"
              size="xs"
              :aria-label="inScope(card) ? `Remove ${card.name} from Scope` : `Add ${card.name} to Scope`"
              @click="toggleScope(card)"
            >
              {{ inScope(card) ? 'In scope' : 'Add' }}
            </UButton>
          </td>
        </tr>
        <tr v-if="!rows.length">
          <td colspan="5" class="px-2 py-6 text-center text-muted">No cards match the current filters.</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
