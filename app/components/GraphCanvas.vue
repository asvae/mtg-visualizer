<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch, inject } from 'vue';
import { createGraphRenderer, type RenderOptions, type GraphHandlers } from '../lib/graphRenderer';
import type { AttrFilters } from '../lib/filters';
import { StoreKey } from '../composables/useGraphStore';
import type { GraphFile } from '../types';

const props = defineProps<{ graph: GraphFile }>();
const store = inject(StoreKey)!;
const svgEl = ref<SVGSVGElement | null>(null);
let renderer: ReturnType<typeof createGraphRenderer> | null = null;
// Last `props.graph` this renderer instance actually reflects — compared
// against the NEXT value by the graph-identity watcher below to compute
// which ids were added/removed (patched in place via renderer.addCards()/
// removeCards()) rather than falling back to a full destroy+recreate. See
// that watcher's own comment.
let knownGraph: GraphFile | null = null;

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

function currentForces() {
  return {
    cardCharge: store.cardCharge.value,
    gravity: store.gravity.value,
    linkStrength: store.linkStrength.value,
    linkDistanceScale: store.linkDistanceScale.value,
    collidePadding: store.collidePadding.value,
    alphaDecay: store.alphaDecay.value,
    velocityDecay: store.velocityDecay.value,
    sourceNormBudget: store.sourceNormBudget.value,
    sinkNormBudget: store.sinkNormBudget.value,
    qtyBoost: store.qtyBoost.value,
  };
}

// PRD 04 "List view" — set the moment GraphCanvas starts tearing down
// (onBeforeUnmount below), and checked by the deferred first-render IIFE
// inside onMounted before it touches `renderer` — see that IIFE's own
// comment for why this guard exists (a real race PRD 04 made reachable for
// the first time: switching to List view fast enough that a slow font-load
// promise is still pending when GraphCanvas unmounts).
let destroyed = false;

onMounted(() => {
  // Shared across the initial creation below AND the graph-identity watcher
  // further down (PRD 01 Scope/Deck editing) — same handlers either way, so
  // this is defined once rather than duplicated at both call sites.
  const handlers = {
    onCardHover(card: Parameters<GraphHandlers['onCardHover']>[0], links: Parameters<GraphHandlers['onCardHover']>[1], event: MouseEvent) {
      store.hovered.value = { kind: 'card', card, links };
      store.mouseX.value = event.clientX;
      store.mouseY.value = event.clientY;
    },
    onHoverMove(event: MouseEvent) {
      store.mouseX.value = event.clientX;
      store.mouseY.value = event.clientY;
    },
    onHoverEnd() {
      store.hovered.value = null;
    },
    onCardClick(card: Parameters<GraphHandlers['onCardClick']>[0], event: MouseEvent) {
      // PRD 02 "Navigation" — a plain click now opens/switches the
      // right-side peek panel (store.openCardPanel) instead of the old
      // "every click opens the full page in a new tab" behavior, so the
      // graph itself stays on screen behind it. Ctrl/Cmd-click is kept as an
      // escape hatch for the old behavior (open the full page directly in a
      // new tab, bypassing the panel) — no more Ctrl/Cmd-click-to-Scryfall
      // shortcut either way; the hover-only Scryfall icon
      // (graphRenderer.ts's `.scryfall-link`) is the one discoverable way
      // there now, and stops its own click from ever reaching here.
      // click-to-select (store.cardSelection/toggleCardSelection) is still
      // off for now, left in place but unused here — the peek panel is a
      // separate mechanism from that dormant highlight feature.
      if (event.ctrlKey || event.metaKey) {
        window.open(`/app/card/${card.set}/${card.collectorNumber}`, '_blank', 'noopener');
        return;
      }
      store.openCardPanel(card.set, card.collectorNumber);
    },
    onBackgroundClick() {
      store.cardSelection.clear();
      // Clicking empty canvas is this graph's own "click outside" — closes
      // the peek panel same as Escape/clicking outside it elsewhere on the
      // page (CardPeekPanel.vue's own document-level listener deliberately
      // ignores clicks inside #graph, precisely so a click on a NODE — which
      // should switch the panel, not close it — never races this handler).
      store.closeCardPanel();
    },
  };

  // Created once per graph identity. render()/applySearch() below only ever
  // mutate this same instance's persistent node objects — Vue never
  // re-mounts this <svg>, so node positions, zoom, and drag state all
  // survive every filter/search change untouched. Rebuilt from scratch (see
  // the `props.graph` watcher further down) only when the card/link SET
  // itself changes.
  //
  // Deliberately NOT rendered yet here (that used to happen synchronously,
  // right after construction) — the very first render() still waits on a
  // font-load promise (see the deferred IIFE at the end of this function,
  // for why), and every `watch()` below needs to be registered SYNCHRONOUSLY
  // within this callback, not after an `await`, to actually get cleaned up
  // by Vue on unmount (see this file's own PRD 04 "List view" note below).
  renderer = createGraphRenderer(svgEl.value!, props.graph, handlers);
  // Baseline for the graph-identity watcher's own additive-vs-rebuild
  // diffing further down — see that watcher's own comment.
  knownGraph = props.graph;

  // Colors/Rarity/Type — narrows/widens which already-known cards are
  // active, same SHAPE of change an add/remove diff below is (a card
  // becoming visible/invisible again, not a genuinely different render) —
  // so this passes `soft: true` through to render()'s own third parameter,
  // same clamped reheat addCards()/removeCards() get, instead of the flat
  // alpha(0.6) resettle a real shape change still deserves. Split out from
  // the keyword/synergy-edges/relation-hub watcher below specifically so
  // toggling one of THOSE (which really can reshape the graph — spawn/
  // despawn a hub, add/remove a whole edge category) keeps its own full
  // reheat, unaffected by this softening.
  watch(
    () => [...store.selectedColors, ...store.selectedRarities, ...store.selectedTypes],
    () => renderer!.render(currentFilters(), currentRenderOptions(), true)
  );
  // Keyword-hub selection, the synergy-edges show/hide toggle, and the
  // relation-hub prototype's own enable/threshold controls (both edge/
  // hub-level, not part of AttrFilters itself — see render()'s own second
  // parameter, RenderOptions) — spreading each reactive Set inside the
  // getter makes Vue track their iteration, so add/delete on any of these
  // re-triggers this.
  watch(
    () => [
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
    () => renderer!.setForces(currentForces()),
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

  // PRD 01 "Core concepts" — Scope/Deck editing (addCardToScope,
  // removeCardFromScope, addCardToDeck, setDeckEntryQuantity, ...) changes
  // the actual card/link SET the graph renders, which `props.graph` (now a
  // computed union, see useGraphStore.ts's own `graph`) reflects as a brand
  // new object each time. Unlike every watcher above (which only ever
  // narrow/restyle the SAME fixed node set — see this component's own
  // "persistent node objects" comment), the renderer has no mechanism to
  // patch its node/link set in place once created (graphRenderer.ts builds
  // `cardNodeById`/`linksByCard` once, at construction, from whatever graph
  // it was given) — so a genuine membership change rebuilds the renderer
  // from scratch instead, the same "start over" trade-off the existing
  // Rerender button already accepts, just triggered automatically here
  // rather than by a manual click. Re-applies every other bit of current
  // state (filters, forces, gravity mode, search, card selection) onto the
  // fresh instance so a Scope/Deck edit doesn't ALSO silently reset any of
  // those. Never fires from a plain filter change (Colors/Rarity/Type/
  // Keywords/showSynergyEdges don't feed into the `graph` computed at all).
  watch(
    () => props.graph,
    (newGraph) => {
      // PRD 03 "Search" (discover-add), extended by a later task to also
      // cover removal (Scope remove, a Deck quantity dropping to 0, a Deck
      // clear/replace-import) — diffs the incoming graph against
      // `knownGraph` (the last one this renderer instance actually
      // reflects) and patches the EXISTING renderer instance via
      // addCards()/removeCards() for whichever ids appeared/disappeared,
      // instead of the full destroy+recreate below, so already-settled node
      // positions, zoom/pan, and active filters survive untouched. The two
      // calls are independent (a card id can't newly appear AND newly
      // vanish in the same diff, so there's no ordering hazard) — this
      // covers a Deck replace-import that adds and removes entries in the
      // very same reactive tick, not just a pure single-direction add.
      //
      // The full-rebuild branch below is, in practice, a defensive
      // fallback rather than a live code path: this app has no in-session
      // way to swap the underlying card POOL at all — `SET_CODE`
      // (useGraphStore.ts) is frozen at module-eval time, and switching
      // sets/`?sf=` queries (AppHeader.vue) does a hard
      // `window.location.href` navigation, which tears down this whole
      // component (and the store with it) rather than mutating
      // `props.graph` in place. So a genuinely different graph never
      // reaches this watcher — only `knownGraph`/`renderer` somehow being
      // unset (which shouldn't happen once mounted) falls through to it.
      if (renderer && knownGraph) {
        const prevIds = new Set(knownGraph.cards.map((c) => c.id));
        const newIds = new Set(newGraph.cards.map((c) => c.id));
        const addedCards = newGraph.cards.filter((c) => !prevIds.has(c.id));
        const removedIds = [...prevIds].filter((id) => !newIds.has(id));
        if (addedCards.length > 0 || removedIds.length > 0) {
          if (removedIds.length > 0) renderer.removeCards(removedIds);
          if (addedCards.length > 0) {
            const prevLinkKeys = new Set(knownGraph.links.map((l) => `${l.a}::${l.b}`));
            const newLinks = newGraph.links.filter((l) => !prevLinkKeys.has(`${l.a}::${l.b}`));
            renderer.addCards(addedCards, newLinks);
          }
        }
        knownGraph = newGraph;
        return;
      }
      renderer?.destroy();
      renderer = createGraphRenderer(svgEl.value!, newGraph, handlers);
      renderer.render(currentFilters(), currentRenderOptions());
      renderer.setForces(currentForces());
      renderer.setGravityMode(store.gravityMode.value);
      renderer.applySearch(store.searchQuery.value);
      renderer.setCardSelection(new Set(store.cardSelection));
      knownGraph = newGraph;
    }
  );

  // The very first real render — deferred behind a font-load wait so
  // graphRenderer.ts's title-fitting (fitTitleText/measureTextWidth, which
  // measures via an offscreen <canvas> context) doesn't silently measure
  // against a fallback font if 'EB Garamond' (nuxt.config.ts's head link)
  // hasn't actually finished loading yet — node titles are only ever fit
  // once (at render time, not re-computed later), so any node whose title
  // got measured against that fallback during this race stays wrong (over-
  // shrunk relative to the space really available) for the rest of this
  // graph's life. No-ops harmlessly if the Font Loading API isn't available.
  //
  // Deliberately a fire-and-forget async IIFE here, AFTER every synchronous
  // `watch()`/`onBeforeUnmount` registration above/below rather than the
  // whole `onMounted` callback itself being `async` with this awaited
  // inline (which is what this file did before PRD 04 "List view") — a
  // watcher (or anything else instance-scoped, like `onBeforeUnmount`)
  // created AFTER an `await` inside an async lifecycle-hook callback loses
  // its tie to the component entirely: Vue's internal "current instance"
  // context is only set synchronously during the hook's own call, not
  // through any awaited continuation, so a `watch()` registered post-await
  // silently keeps running FOREVER past unmount instead of being
  // auto-stopped. That was harmless before this PRD (GraphCanvas was never
  // actually unmountable while the rest of the page stayed alive — the only
  // way to leave it was a real page navigation, which tears down its own
  // watch-sources, i.e. this store, right along with it), but PRD 04's
  // Graph/List toggle unmounts GraphCanvas while FilterPanel (mutating the
  // very same store refs those zombie watchers read) stays mounted — a
  // filter change afterward fired a zombie `render()` call against an
  // already-`destroy()`ed renderer/detached `<svg>`, which threw a real
  // `NotFoundError: insertBefore ...` and corrupted the page (confirmed via
  // Playwright: reproduced reliably, fixed by this restructure, see
  // .claude/agent-memory/ui/notes.md for the live before/after).
  //
  // `destroyed` (module-scope `let`, declared above this component's own
  // `onMounted`) guards the one remaining race this doesn't structurally
  // fix: unmounting fast enough that this promise is STILL pending when
  // `onBeforeUnmount` runs — without it, this would call `renderer!.render()`
  // on an already-destroyed instance/detached SVG once the font promise
  // finally resolves.
  (async () => {
    if (typeof document !== 'undefined' && document.fonts) {
      // .load() (not just .ready) — nothing on the page has actually USED
      // this font before now, so nothing may have triggered the browser to
      // start fetching it yet; .ready only waits for loads already in
      // flight, and could resolve trivially fast without this explicit
      // request.
      try {
        await document.fonts.load('600 16px "EB Garamond"');
      } catch {
        // network hiccup fetching the font — proceed anyway, title-fitting
        // just risks the fallback-font race this was meant to avoid
      }
    }
    if (destroyed || !renderer) return;
    renderer.render(currentFilters(), currentRenderOptions());
  })();
});

onBeforeUnmount(() => {
  destroyed = true;
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
