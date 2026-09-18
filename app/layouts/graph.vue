<script setup lang="ts">
import { provide, onMounted, watch, computed } from 'vue';
import { useGraphStore, StoreKey } from '../composables/useGraphStore';
import type { GravityMode } from '../lib/graphRenderer';

const GRAVITY_MODE_ITEMS: { label: string; value: GravityMode }[] = [
  { label: 'Layout: Default', value: 'default' },
  { label: 'Layout: Mana cost', value: 'manaCost' },
];

// Physics controls only make sense on the graph page itself (they tune the
// D3 simulation index.vue renders) — not on the card detail page, which
// shares this same layout but has no graph on screen.
const route = useRoute();
const isGraphPage = computed(() => route.path === '/app');

// Owns the store — kept alive across navigation between the graph view
// (pages/app/index.vue) and the card detail page
// (pages/app/card/[set]/[number].vue), since Nuxt keeps a layout mounted across route changes that use the same
// layout name; only the page slotted into it remounts. Avoids re-fetching
// the whole graph (and re-resolving scryfall-query mode) on every navigation
// between them.
const store = useGraphStore();
provide(StoreKey, store);
onMounted(() => store.load());

// 2026-09-16: this corner block is positioned against THIS wrapper (the
// same one `<slot/>` — index.vue's entire root, CardPeekPanel included —
// renders into), not against index.vue's own inner content area. Now that
// CardPeekPanel.vue is a real flex sibling taking real width on the right
// (no longer an `absolute inset-y-0 right-0` overlay — see that component's
// own header comment) rather than floating over the SAME physical corner
// this block already occupied, a static `right-3` would sit the block
// either underneath the open panel or crowded against its left edge. Shifts
// left by the panel's own live width (plus its normal 12px/`right-3`
// margin) whenever it's open, so the block stays clear of it instead.
const panelRightOffset = computed(() => (store.panelCardKey.value ? store.panelWidth.value + 12 : 12));

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
      <div
        v-if="isGraphPage && store.graph.value"
        class="absolute bottom-3 z-10 flex items-center gap-2 transition-[right] duration-150"
        :style="{ right: `${panelRightOffset}px` }"
      >
        <USelect
          :model-value="store.gravityMode.value"
          @update:model-value="(v) => (store.gravityMode.value = v as GravityMode)"
          :items="GRAVITY_MODE_ITEMS"
          class="w-36"
        />
        <PhysicsControls />
      </div>
    </div>
    <TooltipView />
  </div>
</template>
