<script setup lang="ts">
import { inject, ref } from 'vue';
import { StoreKey } from '../store';
import { useFloatingDropdown } from '../composables/useFloatingDropdown';

const store = inject(StoreKey)!;

const physicsButton = ref<HTMLElement | null>(null);
const physicsPanel = ref<HTMLElement | null>(null);
useFloatingDropdown(physicsButton, physicsPanel, store.physicsOpen);

const HELP = {
  themeCharge: 'How strongly theme hub nodes push everything else away. More negative spreads hubs further apart from each other and from cards.',
  cardCharge: 'How strongly card nodes push away from each other and from hubs. More negative makes the whole graph looser and more spread out.',
  gravity: 'Pulls every node toward the center of the screen, independent of what it’s connected to. Higher keeps the graph compact; near 0 lets it drift outward.',
  linkStrength: 'How firmly a card is pulled toward its connected theme(s) along each link. Higher makes clusters snap together tighter.',
  alphaDecay: 'How fast the simulation "cools down" and stops moving. Lower keeps it jiggling and rearranging longer (more time to spread out from a fresh layout); higher settles into place quickly.',
  velocityDecay: 'Friction on node movement each tick. Lower means more momentum/bounce when dragging or resettling; higher is more sluggish and damped.',
  anchorLinkStrength: 'How firmly a theme gets pulled back toward its weak/strong anchor once it strays past the free radius. 0 = anchors have no effect at all.',
  anchorFreeRadius: 'Distance from its anchor where a theme feels zero pull — free to be positioned entirely by its own cards. Pull only kicks in past this.',
  anchorSpread: 'Multiplies how far apart the weak-theme and strong-theme anchor points are. 1 = baseline, 2 = twice as far apart.',
};
</script>

<template>
  <div class="icon-dropdown">
    <button ref="physicsButton" id="physics-toggle" class="icon-btn" aria-label="Physics controls" @click="store.physicsOpen.value = !store.physicsOpen.value">⚙</button>
    <div ref="physicsPanel" id="physics-panel" class="legend-dropdown" :class="{ hidden: !store.physicsOpen.value }">
      <div class="slider-row">
        <label :title="HELP.themeCharge"><span>Theme repulsion <span class="help-icon">ⓘ</span></span> <span class="count">{{ store.themeCharge.value }}</span></label>
        <input type="range" min="-6000" max="-50" step="25" v-model.number="store.themeCharge.value" />
      </div>
      <div class="slider-row">
        <label :title="HELP.cardCharge"><span>Card repulsion <span class="help-icon">ⓘ</span></span> <span class="count">{{ store.cardCharge.value }}</span></label>
        <input type="range" min="-2000" max="-5" step="5" v-model.number="store.cardCharge.value" />
      </div>
      <div class="slider-row">
        <label :title="HELP.gravity"><span>Gravity <span class="help-icon">ⓘ</span></span> <span class="count">{{ store.gravity.value.toFixed(3) }}</span></label>
        <input type="range" min="0" max="0.15" step="0.001" v-model.number="store.gravity.value" />
      </div>
      <div class="slider-row">
        <label :title="HELP.linkStrength"><span>Link strength <span class="help-icon">ⓘ</span></span> <span class="count">{{ store.linkStrength.value.toFixed(2) }}</span></label>
        <input type="range" min="0" max="1.5" step="0.01" v-model.number="store.linkStrength.value" />
      </div>
      <div class="slider-row">
        <label :title="HELP.alphaDecay"><span>Settle speed <span class="help-icon">ⓘ</span></span> <span class="count">{{ store.alphaDecay.value.toFixed(3) }}</span></label>
        <input type="range" min="0.002" max="0.1" step="0.001" v-model.number="store.alphaDecay.value" />
      </div>
      <div class="slider-row">
        <label :title="HELP.velocityDecay"><span>Friction <span class="help-icon">ⓘ</span></span> <span class="count">{{ store.velocityDecay.value.toFixed(2) }}</span></label>
        <input type="range" min="0.05" max="0.9" step="0.01" v-model.number="store.velocityDecay.value" />
      </div>
      <div class="slider-row">
        <label :title="HELP.anchorLinkStrength"><span>Anchor pull <span class="help-icon">ⓘ</span></span> <span class="count">{{ store.anchorLinkStrength.value.toFixed(2) }}</span></label>
        <input type="range" min="0" max="1" step="0.01" v-model.number="store.anchorLinkStrength.value" />
      </div>
      <div class="slider-row">
        <label :title="HELP.anchorFreeRadius"><span>Anchor free radius <span class="help-icon">ⓘ</span></span> <span class="count">{{ store.anchorFreeRadius.value }}</span></label>
        <input type="range" min="0" max="2500" step="10" v-model.number="store.anchorFreeRadius.value" />
      </div>
      <div class="slider-row">
        <label :title="HELP.anchorSpread"><span>Anchor spread <span class="help-icon">ⓘ</span></span> <span class="count">{{ store.anchorSpread.value.toFixed(2) }}×</span></label>
        <input type="range" min="0.5" max="4" step="0.1" v-model.number="store.anchorSpread.value" />
      </div>
      <button id="physics-reset" @click="store.resetForces()">Reset physics</button>
      <button id="physics-rerender" title="Clear every node's position and restart the layout from scratch" @click="store.rerenderLayout()">Rerender</button>
    </div>
  </div>
</template>

<style scoped>
#physics-panel {
  min-width: 220px;
  max-height: 80vh;
  overflow-y: auto;
}

.slider-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.slider-row label {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  cursor: help;
}

.help-icon {
  color: var(--muted);
  font-size: 10px;
}

.slider-row input[type='range'] {
  width: 100%;
  accent-color: #6c7086;
}

#physics-reset,
#physics-rerender {
  background: #2a2c36;
  color: var(--text);
  border: 1px solid #3a3d4a;
  border-radius: 6px;
  padding: 5px 0;
  font-size: 11px;
  cursor: pointer;
  margin-top: 2px;
}

#physics-reset:hover,
#physics-rerender:hover {
  background: #33364280;
}
</style>
