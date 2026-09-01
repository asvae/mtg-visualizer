<script setup lang="ts">
import { computed } from 'vue';
import manifest from '../../data/mana_symbols/manifest.json';

// Renders a literal `{X}` mana/cost symbol straight out of real oracle text
// (e.g. "{T}: Add {C}.") the same way scryfall.com renders its own card
// text: an <abbr> whose visible content is the literal "{X}" (kept for
// accessibility/no-CSS fallback, hidden visually via text-indent, not
// display:none — screen readers still get it), title set to Scryfall's own
// English description, and the actual glyph painted via a per-symbol
// background-image. Scryfall's own card-symbol CSS inlines each icon as a
// base64 SVG data URI right in the rule (no per-icon HTTP request); manifest
// entries here carry that same pre-encoded `dataUri` — see
// `scripts/fetch-mana-symbols.mjs` (`npm run fetch:mana-symbols`, from
// https://scryfall.com/docs/api/card-symbols) and `data/mana_symbols/manifest.json`.
interface Entry {
  dataUri: string;
  english: string;
}

const props = defineProps<{ code: string }>();

const entry = computed(() => (manifest as Record<string, Entry>)[props.code]);
const braced = computed(() => `{${props.code}}`);
</script>

<template>
  <abbr v-if="entry" class="card-symbol" :style="{ backgroundImage: `url(${entry.dataUri})` }" :title="entry.english">{{
    braced
  }}</abbr>
  <span v-else>{{ braced }}</span>
</template>

<style scoped>
/* Same technique as scryfall.com's own card-symbol CSS: a small circular
   badge painted entirely by background-image, with the literal "{X}" text
   still in the DOM (for accessibility / no-image fallback) but shifted off
   to the left far enough to never show. */
.card-symbol {
  display: inline-block;
  margin: 1px 1px -1px 1px;
  vertical-align: -0.1em;
  border-radius: 500px;
  box-shadow: -1px 1px 0 rgba(0, 0, 0, 0.85);
  text-indent: -999em;
  overflow: hidden;
  width: 1em;
  height: 1em;
  background-size: 100% 100%;
  background-position: top left;
  cursor: help;
}
</style>
