<script setup lang="ts">
import { provide, onMounted, watch, computed } from 'vue';
import { useGraphStore, StoreKey } from '../composables/useGraphStore';

// Physics controls only make sense on the graph page itself (they tune the
// D3 simulation index.vue renders) — not on the card detail page, which
// shares this same layout but has no graph on screen.
const route = useRoute();
const isGraphPage = computed(() => route.path === '/app');

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
    <div class="relative flex min-h-0 flex-1">
      <slot />
      <!-- Lives here (the persistent layout), not inside the page slotted
           above — index.vue itself unmounts/remounts across navigation
           (e.g. to/from the card detail page), which was tearing this
           popover's trigger out from under it mid-interaction and crashing
           Reka UI's positioning logic ("parentNode is null"). AppHeader
           never had that problem for the same reason: it's also up here,
           never inside the page. -->
      <div v-if="isGraphPage && store.graph.value" class="absolute top-3 right-3 z-10">
        <PhysicsControls />
      </div>
    </div>
    <TooltipView />
  </div>
</template>
