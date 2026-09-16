<script setup lang="ts">
// Stand-in for a single card image while it's loading — nothing else.
// Same 220px width / rounded-md corners CardMedia.vue's own real card
// images use, MTG's real 63:88 card aspect ratio, diagonal stripes a
// shade lighter than the panel background (border-subtle over panel, not
// the reverse). Self-contained on purpose: no page/panel-level loading
// state, no wrapper — just this one image-shaped box, dropped in wherever
// a CardMedia would eventually render (CardPeekPanel.vue and the full
// card page both use this instead of each keeping their own copy).
</script>

<template>
  <div
    class="aspect-[63/88] w-[220px] shrink-0 animate-pulse rounded-md"
    style="background-image: repeating-linear-gradient(135deg, var(--color-border-subtle) 0px, var(--color-border-subtle) 14px, var(--color-panel) 14px, var(--color-panel) 28px)"
    aria-hidden="true"
  ></div>
</template>
