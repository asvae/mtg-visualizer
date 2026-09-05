<script setup lang="ts">
import { computed } from 'vue';
import { KEYWORD_ICON_PATHS } from '../lib/keywordIcons';

// Renders one keyword's icon (see app/lib/keywordIcons.ts for the actual
// path data and why these are hand-drawn originals rather than pulled from
// an existing source).
const props = withDefaults(defineProps<{ keyword: string; size?: number }>(), { size: 16 });

const svgPaths = computed(() => KEYWORD_ICON_PATHS[props.keyword]);
</script>

<template>
  <svg
    v-if="svgPaths"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    :aria-label="keyword"
    role="img"
    v-html="svgPaths"
  ></svg>
</template>
