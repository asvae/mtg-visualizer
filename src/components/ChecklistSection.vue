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
  <div class="panel-row" v-if="showAllNone">
    <button @click="selectNone">None</button>
    <button v-if="themed" @click="selectStrong">Strong</button>
    <button @click="selectAll">All</button>
  </div>
  <div>
    <label v-for="it in items" :key="it.id" class="theme-item" :class="{ 'theme-item-strong': themed && !it.weak }">
      <input type="checkbox" :checked="selected.has(it.id)" @change="toggle(it.id)" />
      <span v-if="it.dotColor" class="dot" :style="{ background: it.dotColor }"></span>
      {{ it.label }}
      <span v-if="it.count != null" class="count">{{ it.count }}</span>
    </label>
  </div>
</template>

<style scoped>
.panel-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.panel-row button {
  flex: 1;
  background: #2a2c36;
  color: var(--text);
  border: 1px solid #3a3d4a;
  border-radius: 6px;
  padding: 4px 0;
  font-size: 11px;
  cursor: pointer;
}

.theme-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  padding: 4px 2px;
  cursor: pointer;
}

.theme-item-strong {
  font-weight: 700;
}

.theme-item .count {
  margin-left: auto;
  color: var(--muted);
  font-size: 11px;
}

.theme-item .dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  border: 1px solid #ffffff40;
}
</style>
