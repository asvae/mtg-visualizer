<script setup lang="ts">
withDefaults(
  defineProps<{
    images: string[];
    tokens: { name: string; image: string }[];
  }>(),
  {}
);

defineEmits<{ (e: 'imageLoad'): void }>();
</script>

<template>
  <!-- One single row: front face, back face (if any), a divider, then each token —
       every image the same fixed size, regardless of how many are in the row.
       Fixed-size images mean this row grows wider as more faces/tokens show up
       rather than shrinking to fit — scrolls in the rare case a card has more
       images than the container can fit. -->
  <div class="flex items-start gap-1.5 overflow-x-auto">
    <img v-for="(src, i) in images" :key="'face' + i" :src="src" alt="" class="block w-[220px] min-w-0 shrink-0 rounded-md" @load="$emit('imageLoad')" />
    <div v-if="tokens.length" class="w-px shrink-0 self-stretch bg-border"></div>
    <img
      v-for="(t, i) in tokens"
      :key="'token' + i"
      :src="t.image"
      :alt="t.name"
      class="block w-[220px] min-w-0 shrink-0 rounded-md"
      @load="$emit('imageLoad')"
    />
  </div>
</template>
