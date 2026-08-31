<script setup lang="ts">
import type { RelationColumn } from '../lib/relations';

withDefaults(
  defineProps<{
    images: string[];
    tokens: { name: string; image: string }[];
    columns: RelationColumn[];
    showMedia?: boolean;
    showRelations?: boolean;
    // ReviewSession's "relations to remove" list — reads as a removal, not
    // just another relations list, so it needs to look distinct even though
    // it's the exact same column/chip markup.
    removed?: boolean;
  }>(),
  {
    showMedia: true,
    showRelations: true,
    removed: false,
  }
);

defineEmits<{ (e: 'imageLoad'): void }>();
</script>

<template>
  <!-- One single row: front face, back face (if any), a divider, then each token —
       every image the same fixed size, regardless of how many are in the row.
       Fixed-size images mean this row grows wider as more faces/tokens show up
       rather than shrinking to fit — scrolls in the rare case a card has more
       images than the container can fit. -->
  <div v-if="showMedia" class="flex items-start gap-1.5 overflow-x-auto">
    <img v-for="(src, i) in images" :key="'face' + i" :src="src" alt="" class="block w-[220px] min-w-0 shrink-0 rounded-md" @load="$emit('imageLoad')" />
    <div v-if="tokens.length" class="w-px shrink-0 self-stretch bg-border"></div>
    <img
      v-for="(t, i) in tokens"
      :key="'token' + i"
      :src="t.image"
      :alt="t.name"
      class="block w-[220px] min-w-0 shrink-0 rounded-md"
      @load="$emit('imageLoad')"
    />
  </div>

  <!-- Each column has the same flex-basis as one card image (220px) above — that's
       what makes a row of columns line up with the card row above it: N columns
       take the same width as N images. Columns that don't fit wrap onto another
       row instead of scrolling. -->
  <div v-if="showRelations && columns.length" class="mt-2 flex max-w-full flex-wrap gap-1.5">
    <div
      v-for="col in columns"
      :key="col.verb"
      class="flex max-w-full shrink-0 basis-[220px] flex-col items-start gap-0.5 rounded-md border bg-bg px-2 py-1.5"
      :class="removed ? 'border-dashed border-[#c0392b]' : 'border-border'"
    >
      <div class="mb-px flex items-center gap-1.5 text-[11px] text-muted">
        <span class="size-2 shrink-0 rounded-full" :style="{ background: col.color }"></span>
        <strong>{{ col.verb }}:</strong>
      </div>
      <span
        v-for="theme in col.themes"
        :key="theme.label"
        class="flex w-full max-w-full items-center gap-1.5 overflow-hidden text-[11px] font-semibold text-ellipsis whitespace-nowrap text-text"
      >
        <span
          class="inline-flex shrink-0 items-end gap-[3px]"
          :aria-label="`${theme.weight === 1 ? 'Light' : theme.weight === 2 ? 'Medium' : 'Strong'} theme connection`"
          role="img"
        >
          <i
            v-for="level in 3"
            :key="level"
            class="block w-[4px] rounded-[1px] border border-muted/60"
            :class="[level === 1 ? 'h-[7px]' : level === 2 ? 'h-[10px]' : 'h-[13px]', level <= theme.weight ? 'bg-muted' : 'bg-transparent']"
          ></i>
        </span>
        <span :class="{ 'line-through opacity-75': removed }">{{ theme.label }}</span>
      </span>
    </div>
  </div>
</template>
