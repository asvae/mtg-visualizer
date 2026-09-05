<script setup lang="ts">
// Renders functional-model/cards/<slug>/trace.json — the RAW per-scenario
// log (unlike the card page's own "Functional model" facts table, which
// reads cards/<slug>/synergy.json: AI-authored facts, verified against this
// same trace.json but not derived from it — see SYNERGY_DESIGN.md). This
// component keeps each scenario's own ordered log intact — for seeing
// exactly what ONE specific scenario actually did, in the order it
// happened, not just a deduplicated set of facts.
interface TraceResult {
  scenario: { setup: string; action: string; result: string };
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
  <div class="flex flex-col gap-3">
    <div
      v-for="(trace, ti) in traces"
      :key="ti"
      class="text-[11px]"
      :class="{ 'border-t border-border-subtle pt-3': ti > 0 }"
    >
      <div class="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-muted">
        <span v-if="trace.scenario.setup"><span class="text-muted/60">setup:</span> {{ trace.scenario.setup }}</span>
        <span v-else class="text-muted/60">setup: default board</span>
        <span><span class="text-muted/60">action:</span> {{ trace.scenario.action }}</span>
        <span class="text-text"><span class="text-muted/60">result:</span> {{ trace.scenario.result }}</span>
        <span class="text-muted/50">({{ trace.log.length }})</span>
      </div>
      <div class="mt-1.5 overflow-x-auto rounded border border-border bg-panel p-2">
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
              <td class="py-0.5 pr-3 text-muted/50">{{ ei + 1 }}</td>
              <td class="py-0.5 pr-3 text-text">{{ entry.fn }}</td>
              <td class="py-0.5 whitespace-pre-wrap text-muted">{{ fieldsOf(entry) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
