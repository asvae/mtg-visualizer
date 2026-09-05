<script setup lang="ts">
import { inject, computed, ref, watch, nextTick } from 'vue';
import { computePosition, offset, flip, shift, size, type VirtualElement } from '@floating-ui/dom';
import { StoreKey, type HoveredCard } from '../composables/useGraphStore';

const store = inject(StoreKey)!;

const cardTooltip = computed<HoveredCard | null>(() => (store.hovered.value?.kind === 'card' ? store.hovered.value : null));

// Every image (front/back face, each token) sits in one row, same size — the more
// of them there are, the wider the tooltip needs to be to keep any one legible.
const isWide = computed(() => {
  const c = cardTooltip.value?.card;
  return !!c && c.images.length + c.tokens.length > 1;
});

// One row per distinct relation (fact description), not one per neighbour card —
// a card with dozens of matches (a broad, unconstrained fact — see graph-links.ts)
// used to mean dozens of name rows to scroll through; this collapses it to "how
// many cards, and how strong on average" per relation instead, sorted most-common
// first. Counts distinct CARDS per relation (a Set, not a running tally) since a
// card can carry the same description only once per link anyway (graph-links.ts
// already dedupes that), but this stays correct even if that ever changes.
// Missing weight (a reason predating the weight fields) counts as 1 for the
// average — same floor graphRenderer.ts's linkQuality uses, so what's displayed
// here matches what's actually driving the graph's own physics.
const relationCounts = computed(() => {
  if (!cardTooltip.value) return [];
  const byDescription = new Map<string, { cards: Set<string>; weightSum: number; weightCount: number }>();
  for (const l of cardTooltip.value.links) {
    for (const r of l.reasons) {
      if (!byDescription.has(r.description)) byDescription.set(r.description, { cards: new Set(), weightSum: 0, weightCount: 0 });
      const g = byDescription.get(r.description)!;
      g.cards.add(l.card.id);
      g.weightSum += r.weight ?? 1;
      g.weightCount++;
    }
  }
  return [...byDescription.entries()]
    .map(([description, g]) => ({ description, count: g.cards.size, avgWeight: g.weightSum / g.weightCount }))
    .sort((a, b) => b.count - a.count);
});

const tooltipEl = ref<HTMLElement | null>(null);
const tipX = ref(0);
const tipY = ref(0);

// A zero-size "virtual element" at the cursor position — floating-ui positions the
// tooltip relative to this point the same way it would relative to a real DOM node.
// offset() pushes the tooltip away from that point (so it never sits under the
// cursor), flip() swaps to whichever side actually has room, shift() nudges it
// sideways to stay clear of the viewport edges without ever flipping back over the
// cursor, and size() caps the tooltip's own height to whatever room is actually
// available on the side flip() picked — a card with dozens of matched neighbours
// (some cards' link lists are long now — see graph-links.ts) can be taller than
// the viewport itself; without a cap it just ran off-screen with no way to see the
// rest. The cap is enforced via the template's own overflow-y:auto, which turns
// that into an internal scroll instead of clipped/inaccessible content.
function virtualReference(): VirtualElement {
  return {
    getBoundingClientRect() {
      const x = store.mouseX.value;
      const y = store.mouseY.value;
      return { x, y, width: 0, height: 0, top: y, left: x, right: x, bottom: y };
    },
    // Without this, floating-ui can't reliably resolve the clipping/viewport
    // context for a bare virtual element — flip()/shift() silently under-detect
    // overflow (the tooltip was clipping off the bottom of the screen instead of
    // flipping above the cursor).
    contextElement: document.body,
  };
}

// Mousemove fires faster than a single computePosition() round-trip resolves, so
// multiple calls can be in flight at once — without this guard, an older call that
// happens to resolve after a newer one would stomp the correct (flipped) position
// with a stale one. Only the most recently-STARTED call is allowed to apply.
let positionRequestId = 0;

// Also called directly from each <img>'s @load — card art loads over the network
// asynchronously, so the tooltip's real height isn't known until then; without this,
// the initial position gets computed against a much shorter box (pre-image) and the
// element grows past it once the image arrives, without ever repositioning.
async function updatePosition() {
  if (!store.hovered.value || !tooltipEl.value) return;
  const requestId = ++positionRequestId;
  await nextTick(); // let the wide/narrow class + content settle before measuring
  const { x, y } = await computePosition(virtualReference(), tooltipEl.value, {
    strategy: 'fixed',
    placement: 'bottom-start',
    middleware: [
      offset(16),
      flip(),
      shift({ padding: 8 }),
      size({
        padding: 8,
        apply({ availableHeight }) {
          tooltipEl.value!.style.maxHeight = `${availableHeight}px`;
        },
      }),
    ],
  });
  if (requestId !== positionRequestId) return; // superseded by a newer request — discard
  tipX.value = x;
  tipY.value = y;
}

watch([() => store.mouseX.value, () => store.mouseY.value, () => store.hovered.value], updatePosition);
</script>

<template>
  <div
    ref="tooltipEl"
    class="fixed z-10 max-w-[480px] overflow-y-auto rounded-lg border border-border bg-panel p-2 transition-opacity duration-75"
    :class="{ 'pointer-events-none opacity-0': !store.hovered.value }"
    :style="{ left: `${tipX}px`, top: `${tipY}px`, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }"
  >
    <template v-if="cardTooltip">
      <CardMedia :images="cardTooltip.card.images" :tokens="cardTooltip.card.tokens" @image-load="updatePosition" />
      <div v-if="relationCounts.length" class="mt-2 flex max-w-full flex-col gap-1">
        <div
          v-for="g in relationCounts"
          :key="g.description"
          class="flex max-w-full items-center justify-between gap-2 rounded-md border border-border bg-bg px-2 py-1 text-[11px]"
        >
          <span class="truncate text-muted">{{ g.description }}</span>
          <span class="shrink-0 text-muted">avg {{ g.avgWeight.toFixed(1) }}</span>
          <span class="shrink-0 font-semibold text-text">{{ g.count }}</span>
        </div>
      </div>
    </template>
  </div>
</template>
