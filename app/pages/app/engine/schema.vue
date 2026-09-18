<script setup lang="ts">
// Card-authoring schema reference — one of the `/app/engine/*` console
// tabs, but reachable only via EngineConsoleTabs.vue's own "…" overflow
// trigger (alongside Keywords), not a primary tab: this is a static
// reference page (no review workflow, no per-entry status), genuinely
// different from every other tab here. Read-only: every section below is
// the REAL, current source text of one card-authoring type declaration —
// sliced straight out of `functional-model/card.ts` (rooted at
// `CardDefinition`, its own schema root) by
// `functional-model/card-schema-source.ts`'s own extractor, plus
// `TokenInfo` (the one referenced type actually declared in
// `interfaces.ts` instead) — via `GET /api/card-schema`. Deliberately NOT
// hand-copied/summarized: this file is extremely doc-comment-heavy (real
// Forge/CR citations justifying nearly every field), and re-describing it
// in prose here would drift the moment `card.ts` itself changes.
//
// "Single page is fine" (explicit ask) — no sub-navigation, no
// search/filter shell, no EngineConsoleEntryListPanel: just the tab bar
// (via EngineConsoleShell's own nav slot, for chrome consistency with
// every other tab) followed by one labeled, always-expanded section per
// type, top to bottom. Reuses `EngineConsoleCodeSection` (not a bare
// `FunctionalModelScript`) specifically for its collapse affordance — the
// two biggest sections here (`CardDefinition`, `Effect`) are 500-650 real
// lines each, and letting a reader collapse ones they don't need is a real
// win despite this not being a review workflow. Each section defaults OPEN
// (`default-open`) — a reference page should show everything on load, not
// require 20 individual clicks to reveal content that was the entire point
// of visiting.
import { computed } from 'vue';
import type { CardSchemaTypeEntry } from '../../../../server/api/card-schema.get';
import type { EngineConsoleCodeResult } from '../../../components/engine-console/EngineConsoleCodeSection.vue';

definePageMeta({ layout: 'graph' });

const { data, pending, error } = useFetch<CardSchemaTypeEntry[]>('/api/card-schema');

const entries = computed(() => data.value ?? []);

function toCodeResult(entry: CardSchemaTypeEntry): EngineConsoleCodeResult {
  return { path: entry.file, exists: entry.found, content: entry.source, truncated: false };
}

// `card.ts` is this page's own default/implicit file (stated once in the
// intro paragraph above) — only the one outlier (`TokenInfo`, declared in
// `interfaces.ts` instead) needs its file named again per-section.
function sectionTitle(entry: CardSchemaTypeEntry): string {
  return entry.file === 'functional-model/card.ts' ? entry.name : `${entry.name} (${entry.file})`;
}

useHead({ title: 'Engine | Schema' });
</script>

<template>
  <EngineConsoleShell :pending="pending" :error="error" :can-prev="false" :can-next="false" hide-nav>
    <template #nav>
      <h1 class="mb-1 px-1.5 text-sm font-semibold text-text">Card schema</h1>
      <p class="px-1.5 text-[11px] leading-relaxed text-muted">
        Every real TypeScript type that makes up a card's authoring schema, rooted at
        <code class="rounded bg-surface px-1 py-0.5 font-mono text-[10px] text-text">CardDefinition</code>
        (<code class="font-mono text-[10px]">functional-model/card.ts</code>) — read straight off disk, doc comments
        and all.
      </p>
    </template>

    <template #detail>
      <div class="flex flex-col gap-3">
        <EngineConsoleCodeSection
          v-for="entry in entries"
          :id="entry.name"
          :key="entry.name"
          :title="sectionTitle(entry)"
          language="ts"
          :result="toCodeResult(entry)"
          not-found-label="Not found — this type may have been renamed."
          default-open
        />
        <p v-if="!pending && !entries.length" class="text-xs text-muted italic">No schema types loaded.</p>
      </div>
    </template>
  </EngineConsoleShell>
</template>
