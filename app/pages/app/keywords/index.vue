<script setup lang="ts">
// Keyword/mechanic coverage suite page — one real, engine-piloted replay
// per keyword/mechanic (functional-model/keywords/registry.ts), reusing the
// SAME ScenarioReplay.vue the per-card detail page's own Scenarios tab
// already uses (see that component's own props) rather than a new
// renderer. A `gap` entry (Hexproof/Ward/Protection) has no replay at all —
// shown as a plain, honest "not yet implemented" note instead.
import { computed } from 'vue';
import type { KeywordPageEntry } from '../../../../server/api/keywords/index.get';

definePageMeta({ layout: 'graph' });

const { data, pending, error } = useFetch<KeywordPageEntry[]>('/api/keywords');

const evergreen = computed(() => (data.value ?? []).filter((e) => e.category === 'evergreen'));
const finMechanics = computed(() => (data.value ?? []).filter((e) => e.category === 'fin-mechanic'));
</script>

<template>
  <div class="min-h-0 flex-1 overflow-y-auto p-6">
    <div class="mx-auto max-w-4xl">
      <h1 class="mb-1 text-lg font-semibold text-text">Keyword & mechanic coverage</h1>
      <p class="mb-6 max-w-2xl text-xs leading-relaxed text-muted">
        One real, engine-piloted playthrough per keyword/mechanic — proving the engine genuinely enforces that specific rule (a real
        Comprehensive Rules citation, a real card, no mocks), rather than a bespoke scenario for every one of the 312 cards that merely
        <em>carry</em> the keyword. See a card's own page for its own full scenario suite.
      </p>

      <div v-if="pending" class="text-xs text-muted italic">Loading…</div>
      <div v-else-if="error" class="text-xs text-error">Failed to load: {{ error.message }}</div>

      <template v-else>
        <section class="mb-8">
          <h2 class="mb-3 text-xs font-semibold tracking-wide text-muted uppercase">Evergreen keywords</h2>
          <div class="flex flex-col gap-4">
            <KeywordEntryCard v-for="entry in evergreen" :key="entry.key" :entry="entry" />
          </div>
        </section>

        <section>
          <h2 class="mb-3 text-xs font-semibold tracking-wide text-muted uppercase">FIN-set mechanics</h2>
          <div class="flex flex-col gap-4">
            <KeywordEntryCard v-for="entry in finMechanics" :key="entry.key" :entry="entry" />
          </div>
        </section>
      </template>
    </div>
  </div>
</template>
