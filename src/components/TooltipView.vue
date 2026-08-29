<script setup lang="ts">
import { inject, computed, ref, watch, nextTick } from 'vue';
import { computePosition, offset, flip, shift, type VirtualElement } from '@floating-ui/dom';
import { StoreKey, type HoveredCard, type HoveredTheme } from '../store';
import { ROLES } from '../types';
import { describeRelation, groupChipsByVerb } from '../lib/relations';
import CardMediaRelations from './CardMediaRelations.vue';

const store = inject(StoreKey)!;

const cardTooltip = computed<HoveredCard | null>(() => (store.hovered.value?.kind === 'card' ? store.hovered.value : null));
const themeTooltip = computed<HoveredTheme | null>(() => (store.hovered.value?.kind === 'theme' ? store.hovered.value : null));

// Every image (front/back face, each token) sits in one row, same size — the more
// of them there are, the wider the tooltip needs to be to keep any one legible.
const isWide = computed(() => {
  const c = cardTooltip.value?.card;
  return !!c && c.images.length + c.tokens.length > 1;
});

const tooltipEl = ref<HTMLElement | null>(null);
const tipX = ref(0);
const tipY = ref(0);

// A zero-size "virtual element" at the cursor position — floating-ui positions the
// tooltip relative to this point the same way it would relative to a real DOM node.
// offset() pushes the tooltip away from that point (so it never sits under the
// cursor), flip() swaps to whichever side actually has room, and shift() nudges it
// sideways to stay clear of the viewport edges without ever flipping back over the
// cursor — replaces the old fixed-guess clamp math (which assumed a 340px height).
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
    middleware: [offset(16), flip(), shift({ padding: 8 })],
  });
  if (requestId !== positionRequestId) return; // superseded by a newer request — discard
  tipX.value = x;
  tipY.value = y;
}

watch([() => store.mouseX.value, () => store.mouseY.value, () => store.hovered.value], updatePosition);

const themeLabelById = computed(() => {
  const map = new Map<string, string>();
  store.graph.value?.themes.forEach((t) => map.set(t.id, t.label));
  return map;
});

const relationChips = computed(() => {
  if (!cardTooltip.value) return [];
  return cardTooltip.value.themeEdges.flatMap((te) => {
    const label = themeLabelById.value.get(te.themeId) ?? te.themeId;
    return describeRelation(label, te.role, te.modifiers).map((chip, i) => ({ ...chip, key: `${te.themeId}-${i}` }));
  });
});

// One column per relation type (Produces/Consumes/Relates to/Grants/Magnifies/
// Depends on), theme names listed underneath instead of one verb+theme pill per
// edge — reads better once a card has more than a couple of relations.
const chipColumns = computed(() => groupChipsByVerb(relationChips.value));

function themeTotal(rc: Record<string, number>) {
  return ROLES.reduce((sum, r) => sum + (rc[r] ?? 0), 0);
}
</script>

<template>
  <div ref="tooltipEl" class="tooltip" :class="{ hidden: !store.hovered.value, wide: isWide }" :style="{ left: `${tipX}px`, top: `${tipY}px` }">
    <template v-if="cardTooltip">
      <CardMediaRelations :images="cardTooltip.card.images" :tokens="cardTooltip.card.tokens" :columns="chipColumns" @image-load="updatePosition" />
    </template>
    <template v-else-if="themeTooltip">
      <div class="name">{{ themeTooltip.theme.label }}</div>
      <div class="badges">{{ themeTotal(themeTooltip.theme.roleCounts) }} cards</div>
      <div class="badges" style="margin-top: 6px">
        <span style="color: var(--produce)">● Produce {{ themeTooltip.theme.roleCounts.produce }}</span><br />
        <span style="color: var(--consume)">● Consume {{ themeTooltip.theme.roleCounts.consume }}</span><br />
        <span style="color: var(--atypical)">● Atypical {{ themeTooltip.theme.roleCounts.atypical }}</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.tooltip {
  position: fixed;
  pointer-events: none;
  background: var(--panel);
  border: 1px solid #3a3d4a;
  border-radius: 8px;
  padding: 8px;
  z-index: 10;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  max-width: 480px;
  transition: opacity 0.08s ease;
}

.tooltip.wide {
  max-width: 480px;
}

.tooltip.hidden {
  opacity: 0;
  pointer-events: none;
}

.tooltip .name {
  font-size: 13px;
  font-weight: 600;
  margin-top: 6px;
}

.tooltip .badges {
  font-size: 11px;
  color: var(--muted);
  margin-top: 2px;
}
</style>
