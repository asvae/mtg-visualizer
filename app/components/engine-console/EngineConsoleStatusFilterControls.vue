<script setup lang="ts" generic="C extends string">
// Shared sidebar chrome above an `/app/engine/*` tab's own entry list —
// search box + per-status toggle-filter buttons (each showing its own
// search-scoped count, per this task's own requirement) + a "visible of
// total" line. Paired with `useStatusFilterList.ts`'s own returned state;
// this component renders it, the composable computes it. Generic over the
// same `C` status-color union the composable is (2-value for keywords,
// 5-value gray/purple/blue/yellow/green for the other three tabs).
//
// Optional `#help` slot: a (?) button next to "Filter by status" opening a
// popover, same interaction pattern as AppHeader.vue's own legend popover
// (UPopover + circle-help UButton). Only rendered when a caller actually
// provides the slot (`v-if="$slots.help"`) — content is entirely up to the
// caller since each tab's statuses mean genuinely different things; this
// component only owns the button/popover chrome, not the explanatory text.
import type { StatusFilterOption } from '../../composables/useStatusFilterList';

const props = defineProps<{
  searchQuery: string;
  searchPlaceholder: string;
  statusOptions: StatusFilterOption<C>[];
  activeFilters: Set<C>;
  counts: Map<C, number>;
  visibleCount: number;
  totalCount: number;
}>();
const emit = defineEmits<{
  'update:searchQuery': [value: string];
  toggle: [value: C];
}>();
</script>

<template>
  <UInput
    :model-value="props.searchQuery"
    class="mb-3"
    :placeholder="props.searchPlaceholder"
    icon="i-lucide-search"
    autocomplete="off"
    size="sm"
    @update:model-value="(v) => emit('update:searchQuery', String(v))"
  >
    <template v-if="props.searchQuery" #trailing>
      <UButton
        icon="i-lucide-x"
        color="neutral"
        variant="link"
        size="xs"
        aria-label="Clear search"
        @click="emit('update:searchQuery', '')"
      />
    </template>
  </UInput>

  <div class="mb-3 flex flex-col gap-0.5">
    <div class="mb-1 flex items-center justify-between px-1.5">
      <span class="text-[11px] font-semibold tracking-wide text-muted uppercase">Filter by status</span>
      <UPopover v-if="$slots.help" :content="{ side: 'right', align: 'start' }">
        <UButton icon="i-lucide-circle-help" color="neutral" variant="link" size="xs" square aria-label="Explain these statuses" />
        <template #content>
          <div class="w-72 p-3 text-xs text-muted">
            <slot name="help" />
          </div>
        </template>
      </UPopover>
    </div>
    <button
      v-for="opt in props.statusOptions"
      :key="opt.value"
      type="button"
      class="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-left"
      :class="props.activeFilters.has(opt.value) ? 'text-text' : 'text-muted opacity-40'"
      :title="opt.description"
      @click="emit('toggle', opt.value)"
    >
      <span class="h-2.5 w-2.5 shrink-0 rounded-sm" :style="{ background: opt.color }"></span>
      <span class="truncate text-[11px]">{{ opt.label }} ({{ props.counts.get(opt.value) ?? 0 }})</span>
    </button>
  </div>

  <div class="mb-1 px-1.5 text-[11px] font-semibold tracking-wide text-muted uppercase">
    {{ props.visibleCount }} of {{ props.totalCount }}
  </div>
</template>
