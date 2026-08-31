<script setup lang="ts">
import { inject } from 'vue';
import { StoreKey, type Store } from '../composables/useGraphStore';

const store = inject(StoreKey)!;

interface SliderDef {
  key: keyof Pick<
    Store,
    | 'themeCharge'
    | 'cardCharge'
    | 'gravity'
    | 'linkStrength'
    | 'alphaDecay'
    | 'velocityDecay'
    | 'anchorLinkStrength'
    | 'anchorFreeRadius'
    | 'anchorSpread'
  >;
  label: string;
  help: string;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
}

const SLIDERS: SliderDef[] = [
  {
    key: 'themeCharge',
    label: 'Theme repulsion',
    help: 'How strongly theme hub nodes push everything else away. More negative spreads hubs further apart from each other and from cards.',
    min: -6000,
    max: -50,
    step: 25,
    format: (v) => `${v}`,
  },
  {
    key: 'cardCharge',
    label: 'Card repulsion',
    help: 'How strongly card nodes push away from each other and from hubs. More negative makes the whole graph looser and more spread out.',
    min: -2000,
    max: -5,
    step: 5,
    format: (v) => `${v}`,
  },
  {
    key: 'gravity',
    label: 'Gravity',
    help: 'Pulls every node toward the center of the screen, independent of what it’s connected to. Higher keeps the graph compact; near 0 lets it drift outward.',
    min: 0,
    max: 0.15,
    step: 0.001,
    format: (v) => v.toFixed(3),
  },
  {
    key: 'linkStrength',
    label: 'Link strength',
    help: 'How firmly a card is pulled toward its connected theme(s) along each link. Higher makes clusters snap together tighter.',
    min: 0,
    max: 1.5,
    step: 0.01,
    format: (v) => v.toFixed(2),
  },
  {
    key: 'alphaDecay',
    label: 'Settle speed',
    help: 'How fast the simulation "cools down" and stops moving. Lower keeps it jiggling and rearranging longer (more time to spread out from a fresh layout); higher settles into place quickly.',
    min: 0.002,
    max: 0.1,
    step: 0.001,
    format: (v) => v.toFixed(3),
  },
  {
    key: 'velocityDecay',
    label: 'Friction',
    help: 'Friction on node movement each tick. Lower means more momentum/bounce when dragging or resettling; higher is more sluggish and damped.',
    min: 0.05,
    max: 0.9,
    step: 0.01,
    format: (v) => v.toFixed(2),
  },
  {
    key: 'anchorLinkStrength',
    label: 'Anchor pull',
    help: 'How firmly a theme gets pulled back toward its weak/strong anchor once it strays past the free radius. 0 = anchors have no effect at all.',
    min: 0,
    max: 1,
    step: 0.01,
    format: (v) => v.toFixed(2),
  },
  {
    key: 'anchorFreeRadius',
    label: 'Anchor free radius',
    help: 'Distance from its anchor where a theme feels zero pull — free to be positioned entirely by its own cards. Pull only kicks in past this.',
    min: 0,
    max: 2500,
    step: 10,
    format: (v) => `${v}`,
  },
  {
    key: 'anchorSpread',
    label: 'Anchor spread',
    help: 'Multiplies how far apart the weak-theme and strong-theme anchor points are. 1 = baseline, 2 = twice as far apart.',
    min: 0.5,
    max: 4,
    step: 0.1,
    format: (v) => `${v.toFixed(2)}×`,
  },
];
</script>

<template>
  <UPopover :content="{ side: 'bottom', align: 'end' }">
    <UButton icon="i-lucide-settings-2" color="neutral" variant="subtle" square aria-label="Physics controls" />
    <template #content>
      <div class="flex max-h-[80vh] w-56 flex-col gap-3 overflow-y-auto p-3">
        <div v-for="s in SLIDERS" :key="s.key" class="flex flex-col gap-1">
          <label :title="s.help" class="flex cursor-help justify-between text-[11px] text-muted">
            <span>{{ s.label }} <span class="text-[10px]">ⓘ</span></span>
            <span>{{ s.format(store[s.key].value) }}</span>
          </label>
          <USlider v-model="store[s.key].value" :min="s.min" :max="s.max" :step="s.step" size="sm" />
        </div>
        <UButton color="neutral" variant="subtle" block @click="store.resetForces()">Reset physics</UButton>
        <UButton
          color="neutral"
          variant="subtle"
          block
          title="Clear every node's position and restart the layout from scratch"
          @click="store.rerenderLayout()"
        >
          Rerender
        </UButton>
      </div>
    </template>
  </UPopover>
</template>
