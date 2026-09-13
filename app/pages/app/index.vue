<script setup lang="ts">
import { inject } from 'vue';
import { StoreKey } from '../../composables/useGraphStore';

definePageMeta({ layout: 'graph' });
useHead({ title: 'MtG Synergy Map' });

const store = inject(StoreKey)!;
</script>

<template>
  <div class="relative flex min-h-0 flex-1">
    <FilterPanel />
    <!-- PRD 04 "List view" — a second, functionally-parallel renderer over
         the exact same store.graph the graph view reads; only which
         component is mounted changes, no separate data path. -->
    <template v-if="store.graph.value">
      <GraphCanvas v-if="store.viewMode.value === 'graph'" :graph="store.graph.value" />
      <ListView v-else :graph="store.graph.value" />
    </template>
    <div v-else-if="store.loading.value" class="flex flex-1 items-center justify-center">
      <div
        class="size-8 animate-spin rounded-full border-[3px] border-border border-t-produce"
        aria-hidden="true"
      ></div>
    </div>
    <!-- PRD 02 "Navigation" — mounted ONLY here (the graph page), never from
         the card detail page's own route: that's what actually guarantees a
         direct visit to /app/card/[set]/[number] never shows this, whatever
         `?card=` happens to be in the URL at the time. -->
    <CardPeekPanel />

    <!-- PRD 04 "List view" — Graph/List renderer toggle. Moved here from
         AppHeader.vue (was header chrome; this is a property of the
         graph/list view itself), floating bottom-center over the view area —
         same "absolute ... bottom-3 z-10" floating-control convention the
         gravity-mode/PhysicsControls pair already uses in layouts/graph.vue
         (which floats bottom-RIGHT over this same relative area), just
         centered instead so the two floating groups don't collide.
         UFieldGroup (Nuxt UI v4's real button-joining component) replaces
         the old UButtonGroup, which doesn't exist in this UI version and was
         silently rendering unjoined buttons. -->
    <div v-if="store.graph.value" class="absolute bottom-3 left-1/2 z-10 -translate-x-1/2">
      <UFieldGroup size="sm">
        <UButton
          icon="i-lucide-network"
          :color="store.viewMode.value === 'graph' ? 'primary' : 'neutral'"
          :variant="store.viewMode.value === 'graph' ? 'solid' : 'subtle'"
          aria-label="Graph view"
          @click="store.viewMode.value = 'graph'"
        >
          Graph
        </UButton>
        <UButton
          icon="i-lucide-table"
          :color="store.viewMode.value === 'list' ? 'primary' : 'neutral'"
          :variant="store.viewMode.value === 'list' ? 'solid' : 'subtle'"
          aria-label="List view"
          @click="store.viewMode.value = 'list'"
        >
          List
        </UButton>
      </UFieldGroup>
    </div>
  </div>
</template>
