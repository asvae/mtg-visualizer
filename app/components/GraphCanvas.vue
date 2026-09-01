<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch, inject } from 'vue';
import { createGraphRenderer, type GraphFilters } from '../lib/graphRenderer';
import { StoreKey } from '../composables/useGraphStore';
import type { GraphFile } from '../types';

const props = defineProps<{ graph: GraphFile }>();
const store = inject(StoreKey)!;
const svgEl = ref<SVGSVGElement | null>(null);
let renderer: ReturnType<typeof createGraphRenderer> | null = null;

function currentFilters(): GraphFilters {
  return {
    selectedThemes: store.selectedThemes,
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
    onCardHover(card, themeEdges, event) {
      store.hovered.value = { kind: 'card', card, themeEdges };
      store.mouseX.value = event.clientX;
      store.mouseY.value = event.clientY;
    },
    onThemeHover(theme, event) {
      store.hovered.value = { kind: 'theme', theme };
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
      // Ctrl/Cmd-click opens Scryfall (a "look this up externally" gesture) —
      // everything else navigates to that card's own page instead of
      // selecting it on the graph (click-to-select is off for now; see
      // store.cardSelection/toggleCardSelection, left in place but unused
      // here — not removed, just not wired to this click anymore).
      if (event.ctrlKey || event.metaKey) {
        window.open(card.scryfallUri, '_blank');
        return;
      }
      navigateTo(`/app/card/${card.set}/${card.collectorNumber}`);
    },
    onThemeClick(theme, event) {
      store.toggleThemeSelection(theme.id, event.shiftKey);
    },
    onBackgroundClick() {
      store.themeSelection.clear();
      store.cardSelection.clear();
    },
  });
  renderer.render(currentFilters());

  // Spreading each reactive Set inside the getter makes Vue track their iteration,
  // so add/delete on any filter re-triggers this — one watcher for all four.
  watch(
    () => [...store.selectedThemes, ...store.selectedColors, ...store.selectedRarities, ...store.selectedTypes],
    () => renderer!.render(currentFilters())
  );
  watch(
    () => store.searchQuery.value,
    (q) => renderer!.applySearch(q)
  );
  // immediate: true on both — the URL can already have `focus`/`card` populated
  // by the time this component mounts (store.load() resolves those synchronously
  // before Vue even flushes the v-if that mounts this component), so without it
  // a shared link's highlight silently wouldn't show until the user interacted.
  watch(
    () => [...store.themeSelection],
    (ids) => renderer!.setThemeSelection(new Set(ids)),
    { immediate: true }
  );
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
    () => [
      store.themeCharge.value,
      store.cardCharge.value,
      store.gravity.value,
      store.linkStrength.value,
      store.linkDistanceScale.value,
      store.collidePadding.value,
      store.alphaDecay.value,
      store.velocityDecay.value,
      store.anchorLinkStrength.value,
      store.anchorFreeRadius.value,
      store.anchorSpread.value,
    ],
    ([
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
    ]) =>
      renderer!.setForces({
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
      }),
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

.link-produce { stroke: var(--color-produce); }
.link-consume { stroke: var(--color-consume); }
.link-atypical { stroke: var(--color-atypical); }
/* stroke-dasharray for atypical / modifier edges is set per-edge in JS (data-driven),
   not here — see graphRenderer.ts. */

.search-dim {
  opacity: 0.08;
}

/* Theme nodes stay clickable targets even while dimmed (to select/deselect them
   or click a different one) — 0.08 made them nearly impossible to find and hit. */
.theme.search-dim {
  opacity: 0.45;
}

.search-match {
  filter: drop-shadow(0 0 5px #ffffff) drop-shadow(0 0 5px #ffffff);
}

.node-card {
  cursor: pointer;
}

.node-card .card-shape {
  stroke: #000;
  stroke-width: 0.5;
}

.rarity-label {
  font-weight: 700;
  paint-order: stroke;
  stroke: #000;
  stroke-width: 2.5px;
  stroke-linejoin: round;
  pointer-events: none;
}

.node-theme {
  fill: var(--color-surface);
  stroke: var(--color-focus);
  stroke-width: 1.5;
  cursor: pointer;
}

/* Weak theme: strictly one-sided (all produce, or all consume), zero of anything
   else (e.g. Job Select — 100% produce, nothing in the set reads it back). Dashed +
   muted fill/stroke, and it's invisibly bound to the weak anchor point in the
   simulation (see graphRenderer.ts) — visually and physically, it doesn't act like
   a "real" hub. */
.node-theme-weak {
  fill: #2c2e38;
  stroke: #4a4d5c;
  stroke-dasharray: 6 4;
  opacity: 0.75;
}

/* Debug/explainer markers: the two fixed points every theme is invisibly linked to
   depending on category (see strongAnchor/weakAnchor in graphRenderer.ts) — not
   interactive, not part of the actual graph data. */
.anchor-point {
  fill: none;
  stroke-width: 2;
  stroke-dasharray: 2 4;
  opacity: 0.5;
  pointer-events: none;
}
.anchor-point-strong { stroke: var(--color-produce); }
.anchor-point-weak { stroke: var(--color-atypical); }

.theme-label {
  fill: var(--color-text);
  font-size: 12px;
  font-weight: 600;
  pointer-events: none;
  text-shadow: 0 0 4px var(--color-bg), 0 0 4px var(--color-bg);
}
</style>
