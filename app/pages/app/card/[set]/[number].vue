<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import { describeRelation, groupChipsByVerb } from '../../../../lib/relations';
import { parseShorthand } from '../../../../lib/shorthand';
import type { CardData, EdgeData, ThemeData } from '../../../../types';

definePageMeta({ layout: 'graph' });

const route = useRoute();

interface CardResponse {
  card: CardData;
  edges: EdgeData[];
  themes: ThemeData[];
  shorthand: string | null;
  shorthandReview: 'ai' | 'human' | null;
}

// Prev/next is pure client-side ±1 on the URL's :number — no server
// round-trip to validate a neighbor exists, so clicking Next/Previous (or
// pressing the arrow keys) doesn't wait on anything. A number past either
// edge of the set just 404s into this page's own "Card not found" state.
const currentNumber = computed(() => parseInt(String(route.params.number), 10));
const prevNumber = computed(() => (Number.isFinite(currentNumber.value) && currentNumber.value > 1 ? currentNumber.value - 1 : null));
const nextNumber = computed(() => (Number.isFinite(currentNumber.value) ? currentNumber.value + 1 : null));

// Standalone request — this page owns its data, independent of the big
// client-side graph store (app/composables/useGraphStore.ts). A direct visit
// (bookmark, shared link) renders without needing the whole graph loaded first.
// URL as a getter (not a plain string) so clicking Previous/Next — which
// changes the route params on the same route instance — re-fetches instead of
// only fetching once at first mount. Routed by set/collector-number (same URL
// shape as scryfall.com/card/<set>/<number>) rather than the Scryfall id, so
// prev/next is a plain ±1 on the number segment.
// Not awaited: this route is ssr:false (client-only) anyway, and awaiting
// would suspend this component's own render until the fetch resolves —
// meaning `pending` is already false by the time anything renders, so the
// spinner below never shows on a fresh visit (only on a later Previous/Next
// reactive refetch, once the component's already mounted).
const { data, pending, error } = useFetch<CardResponse>(() => `/api/card/${route.params.set}/${route.params.number}`);

const card = computed(() => data.value?.card ?? null);

const themeLabelById = computed(() => {
  const map = new Map<string, string>();
  data.value?.themes.forEach((t) => map.set(t.id, t.label));
  return map;
});

// Same chip/column pipeline TooltipView.vue uses for the hover popup — this
// page shows the same info, just as a dedicated route instead of a tooltip.
const relationChips = computed(() => {
  if (!data.value) return [];
  return data.value.edges.flatMap((e) => {
    const label = themeLabelById.value.get(e.theme) ?? e.theme;
    return describeRelation(label, e.role, e.weight).map((chip, i) => ({ ...chip, key: `${e.theme}-${i}` }));
  });
});
const chipColumns = computed(() => groupChipsByVerb(relationChips.value));

const shorthandSegments = computed(() => (data.value?.shorthand ? parseShorthand(data.value.shorthand) : null));

useHead(() => ({ title: card.value ? card.value.name : 'Card' }));

// Left/right arrow keys walk the set the same way the Previous/Next links
// do — this page has no text inputs, so no need to guard against typing.
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowLeft' && prevNumber.value != null) navigateTo(`/app/card/${route.params.set}/${prevNumber.value}`);
  else if (e.key === 'ArrowRight' && nextNumber.value != null) navigateTo(`/app/card/${route.params.set}/${nextNumber.value}`);
}
onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
  <div class="flex-1 overflow-y-auto p-6">
    <div v-if="pending" class="flex flex-1 items-center justify-center">
      <div
        class="size-8 animate-spin rounded-full border-[3px] border-border border-t-produce"
        aria-hidden="true"
      ></div>
    </div>
    <div v-else-if="error || !card" class="text-muted">Card not found.</div>
    <template v-else>
      <div class="mb-4 flex items-center justify-between gap-4">
        <NuxtLink to="/app" class="inline-block text-sm text-muted hover:text-text">&larr; Back to graph</NuxtLink>
        <div class="flex items-center gap-3 text-sm">
          <NuxtLink v-if="prevNumber != null" :to="`/app/card/${route.params.set}/${prevNumber}`" class="text-muted hover:text-text">
            &larr; Previous
          </NuxtLink>
          <span v-else class="text-muted/40">&larr; Previous</span>
          <span class="text-muted">#{{ currentNumber }}</span>
          <NuxtLink v-if="nextNumber != null" :to="`/app/card/${route.params.set}/${nextNumber}`" class="text-muted hover:text-text">
            Next &rarr;
          </NuxtLink>
        </div>
      </div>
      <h1 class="mb-3 text-lg font-semibold">{{ card.name }}</h1>
      <CardMedia :images="card.images" :tokens="card.tokens" />
      <p
        v-if="shorthandSegments"
        class="mt-3 border-l-2 pl-2.5 text-sm leading-relaxed whitespace-pre-line text-text"
        :class="data?.shorthandReview === 'ai' ? 'border-orange-500' : 'border-transparent'"
        :title="data?.shorthandReview === 'ai' ? 'Shorthand not yet human-reviewed' : undefined"
      >
        <template v-for="(seg, i) in shorthandSegments" :key="i"
          ><MtgIcon v-if="'icon' in seg" :name="seg.icon" :class="{ italic: seg.italic }" /><ManaSymbol
            v-else-if="'mana' in seg"
            :code="seg.mana"
            :class="{ italic: seg.italic }"
          /><span v-else :class="{ italic: seg.italic }">{{ seg.text }}</span></template
        >
      </p>
      <a :href="card.scryfallUri" target="_blank" rel="noopener" class="mt-3 inline-block text-xs text-muted hover:text-text">
        View on Scryfall &rarr;
      </a>
    </template>
  </div>
</template>
