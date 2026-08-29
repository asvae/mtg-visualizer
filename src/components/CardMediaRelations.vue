<script setup lang="ts">
import { computed } from 'vue';
import type { RelationColumn } from '../lib/relations';

const props = defineProps<{
  images: string[];
  tokens: { name: string; image: string }[];
  columns: RelationColumn[];
}>();

defineEmits<{ (e: 'imageLoad'): void }>();

// Computed algebraically from the CSS constants below (card width, gap, divider
// width) rather than measured from the rendered DOM — every child in .card-media
// is a fixed size, so its total width is fully determined by how many images/
// tokens there are. Binding .chip-columns to this exact value is what makes it
// match the card row's width instead of shrinking/growing to its own content.
const CARD_WIDTH = 220;
const GAP = 6;
const DIVIDER_WIDTH = 1;
const mediaWidth = computed(() => {
  const hasTokens = props.tokens.length > 0;
  const childCount = props.images.length + props.tokens.length + (hasTokens ? 1 : 0);
  if (childCount === 0) return 0;
  const childrenWidth = (props.images.length + props.tokens.length) * CARD_WIDTH + (hasTokens ? DIVIDER_WIDTH : 0);
  return childrenWidth + (childCount - 1) * GAP;
});
</script>

<template>
  <div class="card-media">
    <img v-for="(src, i) in images" :key="'face' + i" :src="src" alt="" @load="$emit('imageLoad')" />
    <div class="token-divider" v-if="tokens.length"></div>
    <img v-for="(t, i) in tokens" :key="'token' + i" :src="t.image" :alt="t.name" @load="$emit('imageLoad')" />
  </div>
  <!-- Same width as .card-media above (see mediaWidth) — cards that don't fit
       scroll (.card-media's overflow-x: auto); relation groups that don't fit
       wrap onto another row instead (flex-wrap: wrap below), never stretching
       this container wider than the card row itself. -->
  <div class="chip-columns" v-if="columns.length" :style="{ width: mediaWidth + 'px' }">
    <div class="chip-column" v-for="col in columns" :key="col.verb">
      <div class="chip-col-header">
        <span class="chip-dot" :class="col.colorClass"></span>
        <strong>{{ col.verb }}:</strong>
      </div>
      <span class="chip-col-theme" v-for="theme in col.themes" :key="theme">{{ theme }}</span>
    </div>
  </div>
</template>

<style scoped>
/* One single row: front face, back face (if any), a divider, then each token —
   every image the same fixed size, regardless of how many are in the row. */
.card-media {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  /* Fixed-size images (below) mean this row grows wider as more faces/tokens show
     up rather than shrinking everything to fit — scrolls in the rare case a card
     has more images than the container can fit. */
  overflow-x: auto;
}

.card-media > img {
  flex: 0 0 220px;
  width: 220px;
  border-radius: 6px;
  display: block;
  min-width: 0;
}

.token-divider {
  align-self: stretch;
  width: 1px;
  background: #3a3d4a;
  flex: 0 0 auto;
}

/* One boxed group per relation type — a dot-coded "Verb:" header, theme names
   listed below it one per line. The border/background is what makes each group
   read as its own distinct list rather than a run of loose text. */
.chip-columns {
  display: flex;
  flex-wrap: wrap;
  gap: 6px; /* matches .card-media's gap, so the two rows line up consistently */
  margin-top: 8px;
  max-width: 100%;
}

.chip-column {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  min-width: 0;
  max-width: 100%;
  background: #14151a;
  border: 1px solid #3a3d4a;
  border-radius: 6px;
  padding: 6px 8px;
}

.chip-col-header {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--muted);
  margin-bottom: 1px;
}

.chip-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.chip-dot.chip-produce { background: var(--produce); }
.chip-dot.chip-consume { background: var(--consume); }
.chip-dot.chip-atypical { background: var(--atypical); }
.chip-dot.chip-magnifier { background: var(--mod-magnifier); }
.chip-dot.chip-granter { background: var(--mod-granter); }
.chip-dot.chip-conditional { background: var(--mod-conditional); }

.chip-col-theme {
  font-size: 11px;
  color: var(--text);
  font-weight: 600;
  white-space: nowrap;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  /* Lines up with the header's "Verb:" text, not its dot (8px dot + 5px gap). */
  margin-left: 13px;
}
</style>
