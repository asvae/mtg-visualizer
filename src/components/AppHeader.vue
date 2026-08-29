<script setup lang="ts">
import { inject, ref } from 'vue';
import { StoreKey } from '../store';
import PhysicsControls from './PhysicsControls.vue';
import { useFloatingDropdown } from '../composables/useFloatingDropdown';

const store = inject(StoreKey)!;

const legendButton = ref<HTMLElement | null>(null);
const legendPanel = ref<HTMLElement | null>(null);
useFloatingDropdown(legendButton, legendPanel, store.legendOpen);
</script>

<template>
  <header>
    <button id="themes-toggle" aria-label="Toggle themes panel" @click="store.panelOpen.value = !store.panelOpen.value">☰</button>
    <div class="search-wrap">
      <input id="search" type="text" placeholder="Search cards or themes…" autocomplete="off" v-model="store.searchQuery.value" />
      <button id="search-clear" v-show="store.searchQuery.value" aria-label="Clear search" @click="store.searchQuery.value = ''">✕</button>
    </div>
    <h1>
      MTG Set Graph
      <span id="set-label" v-if="store.graph.value">— {{ store.graph.value.set.toUpperCase() }} ({{ store.graph.value.cards.length }} cards)</span>
    </h1>
    <div class="icon-group">
      <PhysicsControls />
      <div class="icon-dropdown">
        <button ref="legendButton" id="legend-toggle" class="icon-btn" aria-label="Show legend" @click="store.legendOpen.value = !store.legendOpen.value">?</button>
        <div ref="legendPanel" id="legend" class="legend-dropdown" :class="{ hidden: !store.legendOpen.value }">
          <div class="item"><span class="swatch" style="background: var(--produce)"></span>Produces</div>
          <div class="item"><span class="swatch" style="background: var(--consume)"></span>Consumes</div>
          <div class="item"><span class="swatch dashed"></span>Atypical</div>
          <div class="item">Thicker edge = stronger theme tie</div>
          <div class="item"><span class="node-swatch node-theme-weak"></span>Weak theme (no real synergy — pushed to the edges)</div>
          <div class="item"><span class="swatch-halo"></span>Ring = card power</div>
          <div class="item">Letter = rarity (U/R/M, commons unmarked)</div>
          <div class="item">
            <span class="swatch" style="background: repeating-linear-gradient(90deg, var(--mod-conditional) 0 4px, transparent 4px 7px)"></span>
            Conditional
          </div>
          <div class="item">
            <span class="swatch" style="background: repeating-linear-gradient(90deg, var(--mod-magnifier) 0 4px, transparent 4px 7px)"></span>
            Magnifier
          </div>
          <div class="item">
            <span class="swatch" style="background: repeating-linear-gradient(90deg, var(--mod-granter) 0 4px, transparent 4px 7px)"></span>
            Granter
          </div>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
header {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 16px;
  background: var(--panel);
  border-bottom: 1px solid #2a2c36;
}

header h1 {
  font-size: 16px;
  margin: 0;
  font-weight: 600;
}

#set-label {
  color: var(--muted);
  font-weight: 400;
}

#themes-toggle {
  background: #2a2c36;
  color: var(--text);
  border: 1px solid #3a3d4a;
  border-radius: 6px;
  width: 30px;
  height: 30px;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  flex-shrink: 0;
}

#themes-toggle:hover {
  background: #33364280;
}

.search-wrap {
  position: relative;
  width: 220px;
}

#search {
  background: #14151a;
  color: var(--text);
  border: 1px solid #3a3d4a;
  border-radius: 6px;
  padding: 6px 26px 6px 10px;
  font-size: 12px;
  width: 100%;
}

#search:focus {
  outline: none;
  border-color: #6c7086;
}

#search::placeholder {
  color: var(--muted);
}

#search-clear {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: none;
  color: var(--muted);
  font-size: 11px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  cursor: pointer;
}

#search-clear:hover {
  background: #33364280;
  color: var(--text);
}

.icon-group {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
  flex-shrink: 0;
}

.item {
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.swatch {
  width: 14px;
  height: 3px;
  border-radius: 2px;
}

.swatch.dashed {
  background: repeating-linear-gradient(90deg, var(--atypical) 0 4px, transparent 4px 7px);
}

.node-swatch {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
  background: #3a3d4a;
  border: 1.5px solid #6c7086;
}

.node-swatch.node-theme-weak {
  background: #2c2e38;
  border-style: dashed;
  border-color: #4a4d5c;
  opacity: 0.75;
}

.swatch-halo {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid var(--power);
  flex-shrink: 0;
}
</style>
