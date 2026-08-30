<script setup lang="ts">
import { inject, ref } from 'vue';
import { StoreKey } from '../store';
import PhysicsControls from './PhysicsControls.vue';
import ScryfallQueryDialog from './ScryfallQueryDialog.vue';
import { useFloatingDropdown } from '../composables/useFloatingDropdown';

// The review panel is a tagging-workflow tool, not something an end visitor to a
// deployed copy of the app should see — gated behind an env var so it can stay on
// locally while a hosted deployment omits it (VITE_ENABLE_REVIEW unset there).
const reviewEnabled = import.meta.env.VITE_ENABLE_REVIEW === '1';

const store = inject(StoreKey)!;

const legendButton = ref<HTMLElement | null>(null);
const legendPanel = ref<HTMLElement | null>(null);
useFloatingDropdown(legendButton, legendPanel, store.legendOpen);

const scryfallDialog = ref<InstanceType<typeof ScryfallQueryDialog> | null>(null);
</script>

<template>
  <header>
    <button id="themes-toggle" aria-label="Toggle themes panel" @click="store.panelOpen.value = !store.panelOpen.value">☰</button>
    <div class="search-wrap">
      <input id="search" type="text" placeholder="Search cards or themes…" autocomplete="off" v-model="store.searchQuery.value" />
      <button id="search-clear" v-show="store.searchQuery.value" aria-label="Clear search" @click="store.searchQuery.value = ''">✕</button>
    </div>
    <a id="logo-link" href="/" aria-label="Back to landing page">
      <svg id="logo-mark" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <circle cx="12" cy="5" r="2.4" fill="var(--produce)" />
        <circle cx="5" cy="17" r="2.4" fill="var(--consume)" />
        <circle cx="19" cy="17" r="2.4" fill="var(--magnifier)" />
        <line x1="12" y1="5" x2="5" y2="17" stroke="currentColor" stroke-width="1.4" />
        <line x1="12" y1="5" x2="19" y2="17" stroke="currentColor" stroke-width="1.4" />
        <line x1="5" y1="17" x2="19" y2="17" stroke="currentColor" stroke-width="1.4" />
      </svg>
      <h1>
        MtG Synergy Map
        <span id="set-label" v-if="store.graph.value">— {{ store.graph.value.set.toUpperCase() }} ({{ store.graph.value.cards.length }} cards)</span>
      </h1>
    </a>
    <div class="icon-group">
      <button id="scryfall-toggle" class="icon-btn" aria-label="Scryfall query filter" @click="scryfallDialog?.open()">🔍</button>
      <PhysicsControls />
      <button
        v-if="reviewEnabled"
        id="review-toggle"
        class="icon-btn"
        aria-label="Card review session"
        @click="store.reviewSessionOpen.value = !store.reviewSessionOpen.value"
      >
        🧾
      </button>
      <div class="icon-dropdown">
        <button ref="legendButton" id="legend-toggle" class="icon-btn" aria-label="Show legend" @click="store.legendOpen.value = !store.legendOpen.value">?</button>
        <div ref="legendPanel" id="legend" class="legend-dropdown" :class="{ hidden: !store.legendOpen.value }">
          <div class="legend-section-title">Relations</div>
          <div class="item" title="Generates or creates more of this theme's resource.">
            <span class="swatch" style="background: var(--produce)"></span>Produces
            <span class="help-icon">?</span>
          </div>
          <div class="item" title="Reads or reacts to this theme's resource that's already present.">
            <span class="swatch" style="background: var(--consume)"></span>Consumes
            <span class="help-icon">?</span>
          </div>
          <div class="item" title="Relates to the theme but doesn't cleanly produce, consume, grant, or magnify it.">
            <span class="swatch dashed"></span>Atypical
            <span class="help-icon">?</span>
          </div>
          <div class="item" title="Extends an ability to another permanent rather than using it itself.">
            <span class="swatch" style="background: repeating-linear-gradient(90deg, var(--grant) 0 4px, transparent 4px 7px)"></span>
            Grant
            <span class="help-icon">?</span>
          </div>
          <div class="item" title="Doubles or amplifies an effect that's already happening.">
            <span class="swatch" style="background: repeating-linear-gradient(90deg, var(--magnifier) 0 4px, transparent 4px 7px)"></span>
            Magnifier
            <span class="help-icon">?</span>
          </div>

          <div class="legend-divider"></div>
          <div class="legend-section-title">Graph</div>
          <div class="item">Thicker edge = stronger theme tie</div>
          <div class="item">Dashed edge = also atypical, grant, or magnifier — or the card ties to that theme via more than one relation</div>
          <div class="item"><span class="node-swatch node-theme-weak"></span>Weak theme (no real synergy — pushed to the edges)</div>
          <div class="item">Letter = rarity (U/R/M, commons unmarked)</div>
          <div class="item">Click a card to highlight its themes, Ctrl/Cmd-click to open it on Scryfall</div>
        </div>
      </div>
    </div>
  </header>
  <ScryfallQueryDialog ref="scryfallDialog" />
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

#logo-link {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text);
  text-decoration: none;
  flex-shrink: 0;
}

#logo-mark {
  color: var(--muted);
  flex-shrink: 0;
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
  cursor: default;
}

.item[title] {
  cursor: help;
}

.help-icon {
  color: var(--muted);
  font-size: 10px;
}

.legend-section-title {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
  font-weight: 600;
}

.legend-divider {
  border-top: 1px solid #3a3d4a;
  margin: 2px 0;
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
</style>
