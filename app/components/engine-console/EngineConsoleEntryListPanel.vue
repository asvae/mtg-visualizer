<script setup lang="ts" generic="T">
// Shared sidebar entry-list button styling for `/app/engine/*` tabs — the
// exact `<button>` markup/selected-state classes three of the five
// pre-consolidation pages had copy-pasted verbatim; row CONTENT stays
// per-tab (a `row` scoped slot) since that genuinely differs (keywords:
// title + a covered/gap dot; features: a gap number + title + dot;
// predicates: label + dot; sets: collector number + name + dot) — only the
// button chrome/selection-highlight/empty-state text is shared.
withDefaults(
  defineProps<{
    entries: T[];
    keyOf: (entry: T) => string;
    selectedKey: string | null;
    emptyMessage?: string;
  }>(),
  { emptyMessage: 'No entries match the current search/filters.' },
);
defineEmits<{ select: [entry: T] }>();
</script>

<template>
  <button
    v-for="entry in entries"
    :key="keyOf(entry)"
    type="button"
    class="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1.5 text-left text-xs"
    :class="keyOf(entry) === selectedKey ? 'bg-surface text-text' : 'text-muted hover:bg-surface/50 hover:text-text'"
    @click="$emit('select', entry)"
  >
    <slot name="row" :entry="entry" />
  </button>
  <p v-if="!entries.length" class="px-1.5 text-[11px] text-muted italic">{{ emptyMessage }}</p>
</template>
