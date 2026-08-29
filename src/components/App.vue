<script setup lang="ts">
import { provide, onMounted } from 'vue';
import { createStore, StoreKey } from '../store';
import AppHeader from './AppHeader.vue';
import FilterPanel from './FilterPanel.vue';
import GraphCanvas from './GraphCanvas.vue';
import TooltipView from './TooltipView.vue';

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
