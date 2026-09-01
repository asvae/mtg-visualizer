<script setup lang="ts">
import { provide, onMounted, watch } from 'vue';
import { useGraphStore, StoreKey } from '../composables/useGraphStore';

// Owns the store — kept alive across navigation between the graph view
// (pages/app/index.vue) and the card detail page (pages/app/card/[set]/[number].vue),
// since Nuxt keeps a layout mounted across route changes that use the same
// layout name; only the page slotted into it remounts. Avoids re-fetching
// the whole graph (and re-resolving scryfall-query mode) on every navigation
// between them.
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
    <slot />
    <TooltipView />
  </div>
</template>
