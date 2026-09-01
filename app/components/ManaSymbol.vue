<script setup lang="ts">
import { computed } from 'vue';

// Renders a literal `{X}` mana/cost symbol straight out of real oracle text
// (e.g. "{T}: Add {C}.") as its actual Mana font glyph — no curation needed
// per symbol, unlike MtgIcon.vue's word-based ICON_DEFS: mana-font's class
// names are just the symbol code lowercased, slash dropped for hybrid
// symbols ("2/W" -> "ms-2w"), with "T" (tap) as the one special case.
const props = defineProps<{ code: string }>();

const className = computed(() => {
  const c = props.code.toLowerCase();
  return c === 't' ? 'ms-tap' : `ms-${c.replace('/', '')}`;
});
</script>

<template>
  <i class="ms mana-symbol" :class="className" :title="`{${code}}`" :aria-label="`{${code}}`"></i>
</template>

<style scoped>
.mana-symbol {
  font-size: 0.75em;
}
</style>
