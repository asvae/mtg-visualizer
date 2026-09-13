<script setup lang="ts">
import type { RelationColumn } from '../lib/relations';

defineProps<{
  columns: RelationColumn[];
}>();
</script>

<template>
  <!-- Each column has the same flex-basis as one card image (220px) — that's
       what makes a row of columns line up with a card media row above it: N
       columns take the same width as N images. Columns that don't fit wrap
       onto another row instead of scrolling. -->
  <div v-if="columns.length" class="mt-2 flex max-w-full flex-wrap gap-1.5">
    <div
      v-for="col in columns"
      :key="col.verb"
      class="flex max-w-full shrink-0 basis-[220px] flex-col items-start gap-0.5 rounded-md border border-border bg-bg px-2 py-1.5"
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
        <span>{{ theme.label }}</span>
      </span>
    </div>
  </div>
</template>
