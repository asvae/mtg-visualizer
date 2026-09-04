<script setup lang="ts">
// Renders functional-model/cards/<slug>/trace.json — the RAW per-scenario
// log (unlike the card page's own "Functional model" facts table, which
// reads flat-trace.json: deduplicated across scenarios, scenario label
// dropped, since a synergy matcher only cares whether a fact is real, not
// which scenario produced it). This component keeps each scenario's own
// ordered log intact — for seeing exactly what ONE specific scenario
// actually did, in the order it happened, not just the deduplicated set of
// distinct facts across all of them.
interface TraceResult {
  scenario: string;
  log: Record<string, unknown>[];
}
defineProps<{ traces: TraceResult[] }>();

// Same fn/fields rendering the card page's own facts table uses (see
// app/pages/app/card/[set]/[number].vue's factFields) — kept local rather
// than imported so this component stays self-contained with its one prop.
function fieldsOf(entry: Record<string, unknown>): string {
  return Object.entries(entry)
    .filter(([k]) => k !== 'fn')
    .map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`)
    .join('  ');
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div v-for="(trace, ti) in traces" :key="ti" class="text-[11px]">
      <div class="text-muted">{{ trace.scenario }} ({{ trace.log.length }})</div>
      <div class="mt-1 overflow-x-auto rounded border border-border bg-panel p-2">
        <table class="border-collapse font-mono text-xs whitespace-nowrap">
          <thead>
            <tr class="text-[10px] tracking-wide text-muted/70 uppercase">
              <th class="pr-3 pb-1 text-left font-normal">#</th>
              <th class="pr-3 pb-1 text-left font-normal">fn</th>
              <th class="pb-1 text-left font-normal">fields</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(entry, ei) in trace.log" :key="ei" class="align-top">
              <td class="pr-3 text-muted/50">{{ ei + 1 }}</td>
              <td class="pr-3 text-text">{{ entry.fn }}</td>
              <td class="whitespace-pre-wrap text-muted">{{ fieldsOf(entry) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
