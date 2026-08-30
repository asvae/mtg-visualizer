<script setup lang="ts">
import { provide, onMounted } from 'vue';
import { createStore, StoreKey } from '../store';
import AppHeader from './AppHeader.vue';
import FilterPanel from './FilterPanel.vue';
import GraphCanvas from './GraphCanvas.vue';
import TooltipView from './TooltipView.vue';
import ReviewSession from './ReviewSession.vue';

// See AppHeader.vue's matching check — keeps the review panel (and its polling
// against review-server.mjs) from even mounting on a deployment that doesn't set
// VITE_ENABLE_REVIEW, not just hiding its toggle button.
const reviewEnabled = import.meta.env.VITE_ENABLE_REVIEW === '1';

const store = createStore();
provide(StoreKey, store);
onMounted(() => store.load());
</script>

<template>
  <div id="app">
    <AppHeader />
    <div id="body">
      <FilterPanel />
      <GraphCanvas v-if="store.graph.value" :graph="store.graph.value" />
      <ReviewSession v-if="reviewEnabled" />
    </div>
    <TooltipView />
  </div>
</template>

<style scoped>
#app {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

#body {
  flex: 1;
  display: flex;
  min-height: 0;
}
</style>
