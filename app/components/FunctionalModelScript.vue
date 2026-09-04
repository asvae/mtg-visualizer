<script setup lang="ts">
import { computed } from 'vue';
// highlight.js/lib/core (not the default 'highlight.js' entry) + registering
// only the `typescript` language module — the full bundle ships every
// language highlight.js knows, which would be a lot of dead weight for a
// page that only ever highlights one language.
import hljs from 'highlight.js/lib/core';
import typescript from 'highlight.js/lib/languages/typescript';

hljs.registerLanguage('typescript', typescript);

const props = defineProps<{ code: string }>();

const highlighted = computed(() => hljs.highlight(props.code, { language: 'typescript' }).value);
</script>

<template>
  <pre class="fms-root max-h-[32rem] overflow-auto rounded border border-border bg-panel p-2 font-mono text-[10px] leading-relaxed text-text/80"><code v-html="highlighted"></code></pre>
</template>

<style scoped>
/* Maps highlight.js's own token classes onto this app's existing palette
   (the same hex values ForgeCardScript.vue's FORGE_LINE_COLORS and the card
   page's SYNERGY_ROLE_COLORS already use for T:/K:/S:/A: lines and
   enters/trigger/emit/move/source roles) rather than pulling in a stock
   hljs theme stylesheet, which ships its own background/foreground/palette
   choices that would fight this app's own dark theme instead of sitting
   inside it. Every hljs class selector below is wrapped in `:global(...)` —
   Vue's scoped-CSS compiler stamps a `data-v-xxxx` attribute onto the
   RIGHTMOST element of a scoped selector, but the `.hljs-*` spans here are
   injected via `v-html` (raw innerHTML), so they never receive that
   attribute; a plain scoped `.fms-root .hljs-keyword` selector would
   silently never match anything. `:global()` opts these specific selectors
   out of scoping entirely instead. */
.fms-root :global(.hljs-keyword),
.fms-root :global(.hljs-built_in) {
  color: #9dcacf; /* same cyan as ForgeCardScript.vue's T: (trigger) lines */
}
.fms-root :global(.hljs-title.function_),
.fms-root :global(.hljs-title.class_) {
  color: #d8ab88; /* same tan/orange as ForgeCardScript.vue's A: (activated) lines */
}
.fms-root :global(.hljs-string) {
  color: #9ecfa0; /* same green as ForgeCardScript.vue's K: (keyword) lines */
}
.fms-root :global(.hljs-number),
.fms-root :global(.hljs-literal) {
  color: #cfa9d8; /* same purple as ForgeCardScript.vue's S: (static) lines */
}
.fms-root :global(.hljs-type) {
  color: #cfa9d8;
}
.fms-root :global(.hljs-comment) {
  font-style: italic;
  color: var(--color-muted);
}
.fms-root :global(.hljs-punctuation),
.fms-root :global(.hljs-operator) {
  color: var(--color-text);
}
</style>
