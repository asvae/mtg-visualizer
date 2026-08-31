<script setup lang="ts">
interface ChecklistItem {
  id: string;
  label: string;
  count?: number;
  dotColor?: string;
  weak?: boolean;
}

const props = defineProps<{
  items: ChecklistItem[];
  selected: Set<string>;
  showAllNone?: boolean;
  // Theme checklist only: bolds strong (non-weak) labels and offers a "Strong"
  // bulk-select alongside All/None. Other checklists (colors/rarity/type) don't
  // set `weak` on their items at all, so this stays theme-specific.
  themed?: boolean;
}>();

function toggle(id: string) {
  if (props.selected.has(id)) props.selected.delete(id);
  else props.selected.add(id);
}

function selectAll() {
  props.items.forEach((it) => props.selected.add(it.id));
}

function selectNone() {
  props.selected.clear();
}

function selectStrong() {
  props.selected.clear();
  props.items.forEach((it) => {
    if (!it.weak) props.selected.add(it.id);
  });
}
</script>

<template>
  <div v-if="showAllNone" class="mb-2 flex gap-2">
    <UButton class="flex-1 justify-center" color="neutral" variant="subtle" size="xs" @click="selectNone">None</UButton>
    <UButton v-if="themed" class="flex-1 justify-center" color="neutral" variant="subtle" size="xs" @click="selectStrong">Strong</UButton>
    <UButton class="flex-1 justify-center" color="neutral" variant="subtle" size="xs" @click="selectAll">All</UButton>
  </div>
  <div>
    <UCheckbox
      v-for="it in items"
      :key="it.id"
      :model-value="selected.has(it.id)"
      :class="['w-full py-1', themed && !it.weak && 'font-bold']"
      :ui="{ label: 'flex w-full items-center gap-1.5 text-xs' }"
      @update:model-value="toggle(it.id)"
    >
      <template #label>
        <span v-if="it.dotColor" class="size-2.5 shrink-0 rounded-full border border-white/25" :style="{ background: it.dotColor }"></span>
        <span class="truncate">{{ it.label }}</span>
        <span v-if="it.count != null" class="ml-auto text-[11px] text-muted">{{ it.count }}</span>
      </template>
    </UCheckbox>
  </div>
</template>
