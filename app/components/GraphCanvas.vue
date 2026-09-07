<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch, inject } from 'vue';
import { createGraphRenderer, type RenderOptions } from '../lib/graphRenderer';
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

// Edge-level, not per-card, so these stay out of AttrFilters above (which
// governs node visibility) — showSynergyEdges toggles visibility of ALL
// card-to-card synergy edges as a whole (never touches which cards show),
// keywordIds spawns/despawns synthetic keyword-hub nodes (a wholly separate
// edge category, unaffected by showSynergyEdges). Both live entirely in
// graphRenderer.ts; see its own RenderOptions/keyword-hub comments.
function currentRenderOptions(): RenderOptions {
  return {
    showSynergyEdges: store.showSynergyEdges.value,
    keywordIds: store.selectedKeywords,
    // PROTOTYPE relation-hub toggle (see graphRenderer.ts's own
    // RelationHubState/RenderOptions comments) — off by default, no effect
    // on the graph at all unless FilterPanel's own dev control is checked.
    relationHubsEnabled: store.relationHubsEnabled.value,
    relationHubThreshold: store.relationHubThreshold.value,
  };
}

onMounted(async () => {
  // graphRenderer.ts's title-fitting (fitTitleText/measureTextWidth) measures
  // via an offscreen <canvas> context — which silently substitutes a fallback
  // font if 'EB Garamond' (nuxt.config.ts's head link) hasn't actually
  // finished loading yet, WITHOUT erroring. Node titles are only ever fit
  // once (at render time, not re-computed later), so any node whose title
  // got measured against that fallback during this race stays wrong —
  // over-shrunk relative to the space really available — for the rest of
  // this graph's life. Waiting here (a few ms at most, thanks to the
  // preconnect) means every node's very first render already has the real
  // font loaded to measure against. No-ops harmlessly if the Font Loading
  // API isn't available.
  if (typeof document !== 'undefined' && document.fonts) {
    // .load() (not just .ready) — nothing on the page has actually USED this
    // font before now, so nothing may have triggered the browser to start
    // fetching it yet; .ready only waits for loads already in flight, and
    // could resolve trivially fast without this explicit request.
    try {
      await document.fonts.load('600 16px "EB Garamond"');
    } catch {
      // network hiccup fetching the font — proceed anyway, title-fitting
      // just risks the fallback-font race this was meant to avoid
    }
  }
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
  renderer.render(currentFilters(), currentRenderOptions());

  // Spreading each reactive Set inside the getter makes Vue track their iteration,
  // so add/delete on any filter/keyword-hub selection re-triggers this — one
  // watcher for all axes plus the synergy-edges toggle and keyword-hub selection
  // (both edge/hub-level, not part of AttrFilters itself — see render()'s own
  // second parameter, RenderOptions).
  watch(
    () => [
      ...store.selectedColors,
      ...store.selectedRarities,
      ...store.selectedTypes,
      ...store.selectedKeywords,
      store.showSynergyEdges.value,
      store.relationHubsEnabled.value,
      store.relationHubThreshold.value,
    ],
    () => renderer!.render(currentFilters(), currentRenderOptions())
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
    () => [
      store.cardCharge.value,
      store.gravity.value,
      store.linkStrength.value,
      store.linkDistanceScale.value,
      store.collidePadding.value,
      store.alphaDecay.value,
      store.velocityDecay.value,
      store.sourceNormBudget.value,
      store.sinkNormBudget.value,
      store.qtyBoost.value,
    ],
    ([cardCharge, gravity, linkStrength, linkDistanceScale, collidePadding, alphaDecay, velocityDecay, sourceNormBudget, sinkNormBudget, qtyBoost]) =>
      renderer!.setForces({
        cardCharge,
        gravity,
        linkStrength,
        linkDistanceScale,
        collidePadding,
        alphaDecay,
        velocityDecay,
        sourceNormBudget,
        sinkNormBudget,
        qtyBoost,
      }),
    // Without this, the renderer starts on DEFAULT_FORCES and only picks up the
    // real (possibly localStorage-restored) slider values once something actually
    // changes them — immediate applies whatever's currently loaded right away.
    { immediate: true }
  );
  watch(
    () => store.rerenderTrigger.value,
    () => renderer!.resetLayout(currentFilters(), currentRenderOptions())
  );
  // immediate: true — same reasoning as the forces watch above, so a
  // localStorage-restored 'manaCost' mode applies from the first render
  // instead of starting on 'default' and flipping a tick later.
  watch(() => store.gravityMode.value, (mode) => renderer!.setGravityMode(mode), { immediate: true });
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
  /* Overridden per-edge by graphRenderer.ts's applyEdgeStyle (inline style,
     always wins over this class rule) — this is just the pre-first-paint
     fallback before that ever runs. */
  stroke: var(--color-produce);
}

.search-dim {
  /* !important: a dimmed link/node still carries graphRenderer.ts's own
     inline opacity style (the strength gradient) — without this, that
     inline style (higher precedence than a plain class rule) would win and
     search-dimming would silently stop working on edges. */
  opacity: 0.08 !important;
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

.keyword-link {
  /* Dashed + muted slate-violet (graphRenderer.ts's own KEYWORD_HUB_COLOR) —
     visually distinct from a real synergy `.link` (solid, colored by match
     quality) since this is a "you checked this keyword" association, not a
     scored produce/consume/etc relation. Lines themselves stay
     non-interactive even though the hub circle they connect to now is (see
     `.node-keyword` below) — nothing to click/drag a plain connector for. */
  stroke: #7d739c;
  stroke-opacity: 0.3;
  stroke-width: 1.5px;
  stroke-dasharray: 4 3;
  fill: none;
  pointer-events: none;
}

.node-keyword {
  /* Draggable (graphRenderer.ts's keywordDrag) — unlike the links above,
     this needs real pointer events, same as `.node-card`. */
  cursor: grab;
}

.node-keyword:active {
  cursor: grabbing;
}

/* PROTOTYPE relation-hub (graphRenderer.ts's own RelationHubState) — dashed
   like .keyword-link above, but its own copper/amber tone
   (RELATION_HUB_COLOR) rather than keyword-hub's violet, so the two families
   read as visually distinct at a glance despite sharing the same "synthetic
   hub, not a real card" shape. Only ONE of these exists per hub (source card
   -> hub), never one per member — see relationLinkLayer's own comment in
   graphRenderer.ts for why that's a deliberate difference from
   .keyword-link's per-member fan. */
.relation-link {
  stroke: #c9762e;
  stroke-opacity: 0.35;
  stroke-width: 1.5px;
  stroke-dasharray: 4 3;
  fill: none;
  pointer-events: none;
}

.node-relation-hub {
  /* Draggable (graphRenderer.ts's relationDrag) AND clickable (toggles
     expand/collapse) — needs real pointer events, same as .node-keyword. */
  cursor: pointer;
}

.node-relation-hub:active {
  cursor: grabbing;
}
</style>
