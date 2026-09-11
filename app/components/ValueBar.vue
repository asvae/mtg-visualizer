<script setup lang="ts">
// A 1-5 value score as filled ticks rather than a bare number — the score
// itself is a hand-authored mix of real magnitude and "how easy is this to
// actually trigger" (see functional-model/synergy.ts's own `Weight` doc
// comment), a rough single dial rather than a precise measurement, so a
// small bar reads better than a number that invites over-interpreting it.
// Named `value`, not `strength`/`power` — both those names collide with a
// real, unrelated existing concept (d3-force's own `.strength()` API,
// Constraints.power's real creature-power constraint), see synergy.ts's
// own `Weight` doc comment for the naming history.
defineProps<{ value?: number }>();

// `value` is normally a 1-5 Weight, but engine may hand-author a placeholder
// -1 ("not yet reviewed", distinct from a real computed magnitude — see
// synergy.ts's own Weight doc comment). Treat anything <= 0 as "no value
// to show" rather than rendering a nonsensical dot count/label.
const isRealValue = (v: number | undefined): v is number => typeof v === 'number' && v > 0;
</script>

<template>
  <span class="relative inline-flex items-center gap-0.5" :title="isRealValue(value) ? `value ${value}/5` : 'value —'">
    <span
      v-for="n in 5"
      :key="n"
      class="h-2 w-1.5 rounded-sm"
      :class="isRealValue(value) && n <= value ? 'bg-warn/70' : 'bg-border'"
    ></span>
    <!-- Bars alone carry no text node, so selecting/copying a table row
         selected nothing for this column. This overlay reproduces the
         number as real, selectable text — text-transparent keeps it
         invisible so the bars still read as bars. -->
    <span class="absolute inset-0 select-text text-[10px] text-transparent">{{ isRealValue(value) ? value : '—' }}</span>
  </span>
</template>
