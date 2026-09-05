<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch, inject } from 'vue';
import { createGraphRenderer } from '../lib/graphRenderer';
import type { AttrFilters } from '../lib/filters';
import { StoreKey } from '../composables/useGraphStore';
import type { GraphFile } from '../types';

const props = defineProps<{ graph: GraphFile }>();
const store = inject(StoreKey)!;
const svgEl = ref<SVGSVGElement | null>(null);
let renderer: ReturnType<typeof createGraphRenderer> | null = null;

function currentFilters(): AttrFilters {
  return {
    selectedColors: store.selectedColors,
    selectedRarities: store.selectedRarities,
    selectedTypes: store.selectedTypes,
  };
}

onMounted(() => {
  // Created once. render()/applySearch() below only ever mutate this same instance's
  // persistent node objects — Vue never re-mounts this <svg>, so node positions,
  // zoom, and drag state all survive every filter/search change untouched.
  renderer = createGraphRenderer(svgEl.value!, props.graph, {
    onCardHover(card, links, event) {
      store.hovered.value = { kind: 'card', card, links };
      store.mouseX.value = event.clientX;
      store.mouseY.value = event.clientY;
    },
    onHoverMove(event) {
      store.mouseX.value = event.clientX;
      store.mouseY.value = event.clientY;
    },
    onHoverEnd() {
      store.hovered.value = null;
    },
    onCardClick(card, event) {
      // Opens this card's own page in a new tab — the graph itself stays put
      // rather than navigating away from it (unlike the old same-tab
      // navigateTo this replaced). No more Ctrl/Cmd-click-to-Scryfall
      // shortcut — the hover-only Scryfall icon (graphRenderer.ts's
      // `.scryfall-link`) is the one discoverable way there now, and stops
      // its own click from ever reaching here (click-to-select is off for
      // now; see store.cardSelection/toggleCardSelection, left in place but
      // unused here).
      void event;
      window.open(`/app/card/${card.set}/${card.collectorNumber}`, '_blank', 'noopener');
    },
    onBackgroundClick() {
      store.cardSelection.clear();
    },
  });
  renderer.render(currentFilters());

  // Spreading each reactive Set inside the getter makes Vue track their iteration,
  // so add/delete on any filter re-triggers this — one watcher for all three.
  watch(
    () => [...store.selectedColors, ...store.selectedRarities, ...store.selectedTypes],
    () => renderer!.render(currentFilters())
  );
  watch(
    () => store.searchQuery.value,
    (q) => renderer!.applySearch(q)
  );
  // immediate: true — the URL can already have `card` populated by the time this
  // component mounts (store.load() resolves it synchronously before Vue even
  // flushes the v-if that mounts this component), so without it a shared link's
  // highlight silently wouldn't show until the user interacted.
  watch(
    () => [...store.cardSelection],
    (ids) => renderer!.setCardSelection(new Set(ids)),
    { immediate: true }
  );
  watch(
    () => store.lookupHighlightCardId.value,
    (id) => renderer!.setLookupHighlight(id)
  );
  watch(
    () => [store.cardCharge.value, store.gravity.value, store.linkStrength.value, store.linkDistanceScale.value, store.collidePadding.value, store.alphaDecay.value, store.velocityDecay.value],
    ([cardCharge, gravity, linkStrength, linkDistanceScale, collidePadding, alphaDecay, velocityDecay]) =>
      renderer!.setForces({ cardCharge, gravity, linkStrength, linkDistanceScale, collidePadding, alphaDecay, velocityDecay }),
    // Without this, the renderer starts on DEFAULT_FORCES and only picks up the
    // real (possibly localStorage-restored) slider values once something actually
    // changes them — immediate applies whatever's currently loaded right away.
    { immediate: true }
  );
  watch(
    () => store.rerenderTrigger.value,
    () => renderer!.resetLayout(currentFilters())
  );
});

onBeforeUnmount(() => {
  renderer?.destroy();
  // Navigating away (e.g. clicking a card to its detail page) unmounts this
  // component without ever firing the SVG's own mouseleave — without this,
  // TooltipView (which lives in the layout, outside this component) keeps
  // showing whatever was last hovered.
  store.hovered.value = null;
});
</script>

<template>
  <svg id="graph" ref="svgEl"></svg>
</template>

<!-- Deliberately NOT `scoped` — this content is appended directly to the DOM by
     d3 inside graphRenderer.ts, not rendered from this component's own template,
     so Vue's scoped-CSS attribute never reaches it regardless of which file the
     rules live in. Also not Tailwind utility classes for the same reason (nowhere
     to put a class="..." on a Vue template element) — plain CSS referencing the
     same --color-* tokens Tailwind's @theme block defines is the right tool here. -->
<style>
svg#graph {
  flex: 1;
  width: 100%;
  display: block;
  cursor: grab;
}

.link {
  stroke: var(--color-produce);
}

.search-dim {
  opacity: 0.08;
}

.search-match {
  filter: drop-shadow(0 0 5px #ffffff) drop-shadow(0 0 5px #ffffff);
}

.node-card {
  cursor: pointer;
}

.scryfall-link {
  opacity: 0;
  transition: opacity 100ms;
}

.node-card:hover .scryfall-link {
  opacity: 1;
}
</style>
