<script setup lang="ts">
// One collapsible card per keywords/index.vue registry entry — a `covered`
// entry embeds the real replay (ScenarioReplay.vue, same component the
// per-card page's own Scenarios tab uses); a `gap` entry shows only its own
// honest reason for having no scenario.
import { ref } from 'vue';
import type { KeywordPageEntry } from '../../server/api/keywords/index.get';

defineProps<{ entry: KeywordPageEntry }>();
const open = ref(false);
</script>

<template>
  <div class="rounded-lg border border-border-subtle bg-panel">
    <button
      type="button"
      class="flex w-full items-center gap-2.5 px-4 py-3 text-left"
      @click="open = !open"
    >
      <Icon :name="open ? 'lucide:chevron-down' : 'lucide:chevron-right'" class="h-3.5 w-3.5 shrink-0 text-muted" />
      <span class="text-sm font-medium text-text">{{ entry.title }}</span>
      <span class="flex gap-1">
        <span v-for="k in entry.keywords" :key="k" class="rounded bg-bg px-1.5 py-0.5 text-[10px] text-muted">{{ k }}</span>
      </span>
      <span class="font-mono text-[10px] text-muted/70">{{ entry.ruleCite }}</span>
      <span
        class="ml-auto rounded px-1.5 py-0.5 text-[10px] font-medium"
        :class="entry.status === 'covered' ? 'bg-produce/20 text-produce' : 'bg-consume/20 text-consume'"
      >
        {{ entry.status === 'covered' ? 'Covered' : 'Gap — not yet implemented' }}
      </span>
    </button>

    <div v-if="open" class="border-t border-border-subtle px-4 py-3">
      <template v-if="entry.status === 'gap'">
        <p class="text-xs leading-relaxed text-muted">{{ entry.gapNote }}</p>
      </template>
      <template v-else>
        <div v-if="entry.cards.length" class="mb-3 flex gap-3">
          <div v-for="c in entry.cards" :key="c.name" class="text-center text-[10px] text-muted">
            <img v-if="c.images[0]" :src="c.images[0]" :alt="c.name" class="mb-1 h-24 rounded shadow" />
            {{ c.name }}
          </div>
        </div>
        <ScenarioReplay
          v-if="entry.traces.length"
          :traces="entry.traces"
          :card-images="entry.cards[0]?.images"
          :card-keywords="entry.cards[0]?.keywords"
          :card-power="entry.cards[0]?.power"
          :card-toughness="entry.cards[0]?.toughness"
        />
        <div v-else class="text-xs text-muted italic">No trace recorded.</div>
      </template>
    </div>
  </div>
</template>
