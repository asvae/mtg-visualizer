<script setup lang="ts">
import { inject } from 'vue';
import { StoreKey } from '../../composables/useGraphStore';

definePageMeta({ layout: 'graph' });
useHead({ title: 'MtG Synergy Map' });

// Gates the review panel (and its polling against review-server.mjs) from
// even mounting on a deployment that doesn't set NUXT_PUBLIC_ENABLE_REVIEW,
// not just hiding its toggle button.
const config = useRuntimeConfig();
const reviewEnabled = config.public.enableReview;

const store = inject(StoreKey)!;
</script>

<template>
  <div class="relative flex min-h-0 flex-1">
    <FilterPanel />
    <GraphCanvas v-if="store.graph.value" :graph="store.graph.value" />
    <div v-else-if="store.loading.value" class="flex flex-1 items-center justify-center">
      <div
        class="size-8 animate-spin rounded-full border-[3px] border-border border-t-produce"
        aria-hidden="true"
      ></div>
    </div>
    <ReviewSession v-if="reviewEnabled" />
  </div>
</template>
