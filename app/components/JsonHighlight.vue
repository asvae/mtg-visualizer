<script setup lang="ts">
import { computed } from 'vue';
// Same pattern FunctionalModelScript.vue already established for TypeScript:
// `highlight.js/lib/core` (not the default `highlight.js` entry, which ships
// every language it knows) + registering only the `json` language module.
import hljs from 'highlight.js/lib/core';
import json from 'highlight.js/lib/languages/json';

hljs.registerLanguage('json', json);

const props = defineProps<{ json: string }>();

const highlighted = computed(() => hljs.highlight(props.json, { language: 'json' }).value);
</script>

<template>
  <pre class="json-highlight-root font-mono text-[10px] leading-relaxed text-text/80"><code v-html="highlighted"></code></pre>
</template>

<style scoped>
/* Same hand-mapped-onto-this-app's-own-palette approach
   FunctionalModelScript.vue already uses, rather than a stock hljs theme
   stylesheet (which would ship its own background/foreground choices that
   fight this app's own dark theme). `:global(...)` is required on every
   selector below because the `.hljs-*` spans are injected via `v-html`
   (raw innerHTML) and never receive Vue's scoped `data-v-xxxx` attribute —
   a plain scoped `.json-highlight-root .hljs-attr` selector would silently
   match nothing. */
.json-highlight-root :global(.hljs-attr) {
  color: #9dcacf; /* same cyan as FunctionalModelScript.vue's keyword/built_in */
}
.json-highlight-root :global(.hljs-string) {
  color: #9ecfa0; /* same green as FunctionalModelScript.vue's string */
}
.json-highlight-root :global(.hljs-number),
.json-highlight-root :global(.hljs-literal) {
  color: #cfa9d8; /* same purple as FunctionalModelScript.vue's number/literal/type */
}
.json-highlight-root :global(.hljs-punctuation) {
  color: var(--color-muted);
}
</style>
