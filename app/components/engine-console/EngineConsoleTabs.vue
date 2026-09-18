<script setup lang="ts">
// Top-of-sidebar tab bar for the `/app/engine/*` console — four tabs,
// each its own real route (not client-side-only tab state), so a direct
// link/reload lands on the right tab per this task's own requirement.
// Deliberately only 4 entries: `/app/recognizers` was in scope for one
// task iteration then explicitly pulled back OUT (per an explicit
// mid-task correction — leave that page completely untouched, not linked
// here) — don't re-add a 5th "Recognizers" tab without a fresh explicit
// ask. `/app/keywords` (the older standalone route this tab's content
// duplicates) is ALSO deliberately left in place/linked from AppHeader.vue
// alongside this "keywords" tab, not replaced by it — the user was still
// undecided (as of this same task) on whether the keywords tab belongs in
// this console at all, so nothing about the standalone page was removed.
import { computed } from 'vue';

const route = useRoute();

const TABS = [
  { label: 'Keywords', to: '/app/engine/keywords', match: '/app/engine/keywords' },
  { label: 'Predicates', to: '/app/engine/predicates', match: '/app/engine/predicates' },
  { label: 'Cards', to: '/app/engine/sets', match: '/app/engine/sets' },
  { label: 'Features', to: '/app/engine/features', match: '/app/engine/features' },
];

const activeTo = computed(() => TABS.find((t) => route.path.startsWith(t.match))?.to);
</script>

<template>
  <nav class="mb-2 flex gap-0.5 rounded-md bg-bg p-0.5" aria-label="Engine console tabs">
    <NuxtLink
      v-for="tab in TABS"
      :key="tab.to"
      :to="tab.to"
      class="flex-1 rounded px-1.5 py-1 text-center text-[11px] font-medium"
      :class="activeTo === tab.to ? 'bg-surface text-text' : 'text-muted hover:text-text'"
    >
      {{ tab.label }}
    </NuxtLink>
  </nav>
</template>
