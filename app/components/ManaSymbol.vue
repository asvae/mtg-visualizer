<script setup lang="ts">
import { computed } from 'vue';
import manifest from '../../data/mana_symbols/manifest.json';

// Renders a literal `{X}` mana/cost symbol straight out of real oracle text
// (e.g. "{T}: Add {C}.") as Scryfall's own official symbol SVG — self-hosted
// under public/mana_symbols/ (symlinked to data/mana_symbols/, fetched via
// `npm run fetch:mana-symbols` from https://api.scryfall.com/symbology) —
// rather than a third-party font recreation. `manifest.json` maps every
// symbol code Scryfall knows about (e.g. "T", "2/W", "½") to its filename;
// re-run the fetch script if a new symbol shows up that isn't in it yet.
const props = defineProps<{ code: string }>();

const filename = computed(() => (manifest as Record<string, string>)[props.code]);
</script>

<template>
  <img
    v-if="filename"
    class="mana-symbol"
    :src="`/mana_symbols/${filename}`"
    :alt="`{${code}}`"
    :title="`{${code}}`"
  />
  <span v-else>{{ `{${code}}` }}</span>
</template>

<style scoped>
.mana-symbol {
  display: inline-block;
  width: 0.9em;
  height: 0.9em;
  vertical-align: -0.1em;
}
</style>
