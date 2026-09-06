<script setup lang="ts">
import { computed } from 'vue';
import { ABILITY_ICON_PATHS, ABILITY_ICON_VIEWBOX } from '../lib/abilityIconPaths';

// Filled-glyph alternative to KeywordIcon.vue, rendering the icon set from
// ability_icons_svg.zip (user-supplied) instead of the hand-drawn stroke set.
// Source SVGs ship as viewBox 0 0 140 120 but the ink is a small,
// inconsistently-placed blob within that canvas — a single shared crop
// filled the box at badge size (confirmed vs. the full viewBox side-by-side
// in AbilityIcon.stories.ts's BadgeScaling story) but left some icons
// visibly off-center, since each glyph's own bbox center differs. Each
// keyword gets its own 76x76 viewBox (see ABILITY_ICON_VIEWBOX) centered on
// that icon's ink instead. Fill applied via currentColor so it follows
// badge/text color instead of the source's hardcoded white.
const props = withDefaults(defineProps<{ keyword: string; size?: number }>(), { size: 16 });

const path = computed(() => ABILITY_ICON_PATHS[props.keyword]);
const viewBox = computed(() => ABILITY_ICON_VIEWBOX[props.keyword]);
</script>

<template>
  <svg
    v-if="path"
    :width="size"
    :height="size"
    :viewBox="viewBox"
    fill="currentColor"
    :aria-label="keyword"
    role="img"
  ><path :d="path" fill-rule="evenodd" /></svg>
</template>
