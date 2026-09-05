<script setup lang="ts">
import { computed, inject } from 'vue';
import { StoreKey, type Store } from '../composables/useGraphStore';

const store = inject(StoreKey)!;

interface SliderDef {
  key: keyof Pick<Store, 'cardCharge' | 'gravity' | 'linkStrength' | 'alphaDecay' | 'velocityDecay' | 'sourceNormBudget' | 'sinkNormBudget' | 'qtyBoost'>;
  label: string;
  help: string;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  // manaCost mode repurposes/ignores this force entirely (see
  // graphRenderer.ts's xTargetFor/cardChargeFor) — hidden there rather than
  // shown as a live but silently-inert slider.
  hideInManaCostMode?: boolean;
}

const SLIDERS: SliderDef[] = [
  {
    key: 'cardCharge',
    label: 'Card repulsion',
    help: 'How strongly card nodes push away from each other. More negative makes the whole graph looser and more spread out.',
    min: -2000,
    max: -5,
    step: 5,
    format: (v) => `${v}`,
    hideInManaCostMode: true,
  },
  {
    key: 'gravity',
    label: 'Gravity',
    help: 'Pulls every node toward the center of the screen, independent of what it’s connected to. Higher keeps the graph compact; near 0 lets it drift outward.',
    min: 0,
    max: 0.15,
    step: 0.001,
    format: (v) => v.toFixed(3),
    hideInManaCostMode: true,
  },
  {
    key: 'linkStrength',
    label: 'Link strength',
    help: 'How firmly a card is pulled toward its directly-connected cards along each link. Higher makes clusters snap together tighter.',
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
    key: 'sourceNormBudget',
    label: 'Source spread',
    help: 'How much total "output" a single source fact splits across everyone who consumes it. Higher means a fact matched by many cards still counts for a lot per edge; lower shrinks a widely-shared fact\'s influence toward the narrow, specific ones.',
    min: 0,
    max: 30,
    step: 0.5,
    format: (v) => v.toFixed(1),
  },
  {
    key: 'sinkNormBudget',
    label: 'Sink spread',
    help: 'Same as Source spread, but for the demand side — how much total "demand" a single sink fact splits across everyone who supplies it.',
    min: 0,
    max: 30,
    step: 0.5,
    format: (v) => v.toFixed(1),
  },
  {
    key: 'qtyBoost',
    label: 'Qty boost',
    help: 'In deck-import mode, how much a pair\'s own copy counts amplify its edge — 4 copies of each card paired together pulls harder than a 1-of pairing the same way. 0 ignores quantities entirely.',
    min: 0,
    max: 2,
    step: 0.05,
    format: (v) => v.toFixed(2),
  },
];

const visibleSliders = computed(() => SLIDERS.filter((s) => !s.hideInManaCostMode || store.gravityMode.value !== 'manaCost'));
</script>

<template>
  <UPopover :content="{ side: 'bottom', align: 'end' }">
    <UButton icon="i-lucide-settings-2" color="neutral" variant="subtle" square aria-label="Physics controls" />
    <template #content>
      <div class="flex max-h-[80vh] w-56 flex-col gap-3 overflow-y-auto p-3">
        <div v-for="s in visibleSliders" :key="s.key" class="flex flex-col gap-1">
          <label :title="s.help" class="flex cursor-help justify-between text-[11px] text-muted">
            <span>{{ s.label }} <span class="text-[10px]">ⓘ</span></span>
            <span>{{ s.format(store[s.key].value) }}</span>
          </label>
          <!-- Explicit :model-value/@update:model-value (not v-model) — USlider
               emits an array (its own multi-thumb model shape) on every drag,
               and its single-thumb unwrap doesn't reliably run before that
               reaches here, which used to write a real array into the store
               ref (crashing `format`'s own `.toFixed` immediately, and
               persisting as e.g. `"gravity":[0.02]` — the exact stale-array
               shape loadSavedForces's own sanitizer guards a RELOAD against,
               but not the live crash in the same session). Unwrapped here
               instead, once, so the store ref only ever holds a plain number. -->
          <USlider
            :model-value="store[s.key].value"
            @update:model-value="(v) => (store[s.key].value = Array.isArray(v) ? v[0]! : v)"
            :min="s.min"
            :max="s.max"
            :step="s.step"
            size="sm"
          />
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
