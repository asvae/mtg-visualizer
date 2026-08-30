<script setup lang="ts">
import type { RelationColumn } from '../lib/relations';

withDefaults(defineProps<{
  images: string[];
  tokens: { name: string; image: string }[];
  columns: RelationColumn[];
  showMedia?: boolean;
  showRelations?: boolean;
}>(), {
  showMedia: true,
  showRelations: true,
});

defineEmits<{ (e: 'imageLoad'): void }>();
</script>

<template>
  <div class="card-media" v-if="showMedia">
    <img v-for="(src, i) in images" :key="'face' + i" :src="src" alt="" @load="$emit('imageLoad')" />
    <div class="token-divider" v-if="tokens.length"></div>
    <img v-for="(t, i) in tokens" :key="'token' + i" :src="t.image" :alt="t.name" @load="$emit('imageLoad')" />
  </div>
  <!-- Each .chip-column has the same flex-basis as one card image (220px, see
       .card-media > img below) — that's what makes a row of columns line up with
       the card row above it: N columns take the same width as N images. Cards
       that don't fit scroll (.card-media's overflow-x: auto); columns that don't
       fit wrap onto another row instead (flex-wrap: wrap below). -->
  <div class="chip-columns" v-if="showRelations && columns.length">
    <div class="chip-column" v-for="col in columns" :key="col.verb">
      <div class="chip-col-header">
        <span class="chip-dot" :class="col.colorClass"></span>
        <strong>{{ col.verb }}:</strong>
      </div>
      <span class="chip-col-theme" v-for="theme in col.themes" :key="theme.label">
        <span
          class="weight-meter"
          :aria-label="`${theme.weight === 1 ? 'Light' : theme.weight === 2 ? 'Medium' : 'Strong'} theme connection`"
          role="img"
        >
          <i v-for="level in 3" :key="level" :class="{ filled: level <= theme.weight }"></i>
        </span>
        <span>{{ theme.label }}</span>
      </span>
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
  flex: 0 0 220px; /* same basis as .card-media > img — N columns = N image widths */
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
.chip-dot.chip-magnifier { background: var(--magnifier); }
.chip-dot.chip-grant { background: var(--grant); }

.chip-col-theme {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  font-size: 11px;
  color: var(--text);
  font-weight: 600;
  white-space: nowrap;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}

.weight-meter {
  display: inline-flex;
  align-items: flex-end;
  gap: 2px;
  flex-shrink: 0;
}

.weight-meter i {
  display: block;
  width: 2px;
  height: 6px;
  border-radius: 1px;
  background: #35373f;
}

.weight-meter i:nth-child(2) { height: 8px; }
.weight-meter i:nth-child(3) { height: 10px; }
.weight-meter i.filled { background: var(--muted); }
</style>
