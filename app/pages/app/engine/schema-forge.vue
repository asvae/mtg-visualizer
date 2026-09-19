<script setup lang="ts">
// Forge-corpus schema-vocabulary aggregate report — one of the `/app/
// engine/*` console tabs, reachable only via EngineConsoleTabs.vue's own
// "…" overflow trigger (alongside Schema/Keywords), same rationale as
// `schema.vue`: a static reference page, no review workflow, no per-entry
// status. Genuinely different from that sibling page though: this renders
// real Markdown (frequency tables, prose sections) via `MarkdownView.vue`
// rather than TypeScript source via `EngineConsoleCodeSection` — reuses the
// same Markdown renderer `CardDetailTabs.vue`'s "Notes" tab already
// established, per this task's own instruction not to build a second one.
//
// Backed by `GET /api/schema-forge-aggregate`, itself dev-only/gitignored
// (`server/utils/forgeSchemaAggregate.ts`) — the underlying report file
// (`tmp/forge-json-mapper-full-run/schema_aggregate.md`) is local-only
// tooling output from a one-off analysis script, never committed, so this
// page has to tolerate "not available" gracefully rather than assume the
// route always returns content (production, CI, and any fresh checkout all
// hit that path).
import { computed } from 'vue';
import type { ForgeSchemaAggregateResult } from '../../../../server/api/schema-forge-aggregate.get';

definePageMeta({ layout: 'graph' });

const { data, pending, error } = useFetch<ForgeSchemaAggregateResult>('/api/schema-forge-aggregate');

const markdown = computed(() => (data.value?.available ? data.value.content : ''));
const notAvailableReason = computed(() => {
  if (!data.value || data.value.available) return null;
  return data.value.reason === 'dev-only'
    ? 'Only available in local development.'
    : "Not found locally — this is optional local tooling output (re-run the forge-json-mapper full-corpus aggregation script to regenerate it).";
});

useHead({ title: 'Engine | Schema (Forge)' });
</script>

<template>
  <EngineConsoleShell :pending="pending" :error="error" :can-prev="false" :can-next="false" hide-nav>
    <template #nav>
      <h1 class="mb-1 px-1.5 text-sm font-semibold text-text">Forge schema vocabulary</h1>
      <p class="px-1.5 text-[11px] leading-relaxed text-muted">
        Field/param/keyword vocabulary observed across the full real Forge card corpus (33,798 cards, all of Magic's
        history) — groundwork for a possible future Forge JSON &rarr;
        <code class="font-mono text-[10px]">card.ts</code> compiler. Local-only report, not part of this repo.
      </p>
    </template>

    <template #detail>
      <div class="flex flex-col gap-3">
        <p v-if="!pending && notAvailableReason" class="text-xs text-muted italic">{{ notAvailableReason }}</p>
        <MarkdownView v-else-if="!pending && markdown" :markdown="markdown" />
      </div>
    </template>
  </EngineConsoleShell>
</template>
