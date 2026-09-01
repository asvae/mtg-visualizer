<script setup lang="ts">
import { computed } from 'vue';

// Single source of truth for every icon the card shorthand notation can use
// (see CARD_SHORTHAND.md and data/card_shorthands.json). Every mana-font
// keyword-ability/counter/stat icon that was ever added here (landfall,
// trample, vigilance, +1/+1 counter, power, sorcery-speed pip, ...) has
// since been tried and reverted — mana-font is a third-party recreation,
// not an official symbol, and the visual payoff wasn't worth it. The only
// icons that stay are Scryfall's own official ones, and those are literal
// `{X}` mana/cost symbols out of real oracle text — handled entirely by
// ManaSymbol.vue, not here. So ICON_DEFS is intentionally empty: every
// bracket word this component receives just falls through to its plain-text
// fallback below (brackets stripped either way, so a card's `[vigilance]`/
// `[landfall]`/etc. keeps rendering correctly with zero data-file changes
// needed — no need to "fix" existing card text when an icon goes away).
// Re-add an entry here only for a genuine, clearly-fitting Scryfall-adjacent
// icon if one ever turns up; don't reach for mana-font again.
const ICON_DEFS: { classes: string; label: string; words: string[] }[] = [];
// Lookup is case-insensitive — a card writing "[Landfall]" at a sentence
// start and another writing "[trample]" mid-sentence both just work.
const ICONS: Record<string, { classes: string; label: string }> = Object.fromEntries(
  ICON_DEFS.flatMap((d) => d.words.map((w) => [w.toLowerCase(), { classes: d.classes, label: d.label }]))
);

const props = defineProps<{ name: string }>();
const icon = computed(() => ICONS[props.name.toLowerCase()]);
</script>

<template>
  <i v-if="icon" class="mtg-icon" :class="icon.classes" :title="icon.label" :aria-label="icon.label"></i>
  <span v-else>{{ name }}</span>
</template>

<style scoped>
.mtg-icon {
  font-size: 0.75em;
}
</style>
