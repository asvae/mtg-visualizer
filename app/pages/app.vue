<script setup lang="ts">
import { provide, onMounted, watch } from 'vue';
import { useGraphStore, StoreKey } from '../composables/useGraphStore';

useHead({ title: 'MtG Synergy Map' });

// Gates the review panel (and its polling against review-server.mjs) from
// even mounting on a deployment that doesn't set NUXT_PUBLIC_ENABLE_REVIEW,
// not just hiding its toggle button.
const config = useRuntimeConfig();
const reviewEnabled = config.public.enableReview;

const store = useGraphStore();
provide(StoreKey, store);
onMounted(() => store.load());

// Popup for store.dataWarning — fires once whenever a scryfall-query load
// comes back truncated (matched more than the 500-card cap; see
// server/api/cards.ts). Uses Nuxt UI's global toaster (<UApp> in app.vue).
const toast = useToast();
watch(
  () => store.dataWarning.value,
  (msg) => {
    if (msg) toast.add({ title: 'Query truncated', description: msg, color: 'warning', icon: 'i-lucide-triangle-alert' });
  }
);
</script>

<template>
  <div class="flex h-screen flex-col">
    <AppHeader />
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
    <TooltipView />
  </div>
</template>
