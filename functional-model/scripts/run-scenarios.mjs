// Runs every card's own scenarios.ts through functional-model/harness.ts and
// writes the resulting fact log to that card's own trace.json — the
// per-card structure is: definition.ts (definition), scenarios.ts (test inputs,
// data), trace.json (test results, data — this script's output). A synergy
// matcher (see match.mjs) reads trace.json files, never re-runs anything.
//
// A card may instead opt into a REAL engine-piloted trace (see
// engine-trace.ts's own header) by exporting `runEngineScenarios():
// TraceResult[]` from its own `cards/<slug>/engine-scenario.ts` — when
// present, ITS output is used for that card's trace.json instead of the
// harness path (both produce the same TraceResult[] shape, so nothing
// downstream needs to know which one ran). A card without this file is
// completely unaffected — this is an opt-in, per-card exception, not a new
// default.
//
// Usage: npx vite-node functional-model/scripts/run-scenarios.mjs

import { readdir, writeFile } from 'node:fs/promises';

const { runScenarios } = await import('../harness.ts');

const cardsDir = new URL('../cards/', import.meta.url);
const slugs = (await readdir(cardsDir, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name);

for (const slug of slugs) {
  const engineScenarioModule = await import(`../cards/${slug}/engine-scenario.ts`).catch(() => null);
  let results;
  if (engineScenarioModule) {
    results = engineScenarioModule.runEngineScenarios();
  } else {
    const cardModule = await import(`../cards/${slug}/definition.ts`);
    const scenariosModule = await import(`../cards/${slug}/scenarios.ts`).catch(() => null);
    if (!scenariosModule) {
      console.log(`skip ${slug}: no scenarios.ts`);
      continue;
    }
    const card = Object.values(cardModule)[0];
    results = runScenarios(card, scenariosModule.scenarios);
  }
  const outPath = new URL(`../cards/${slug}/trace.json`, import.meta.url);
  await writeFile(outPath, JSON.stringify(results, null, 2) + '\n', 'utf8');
  console.log(`wrote cards/${slug}/trace.json (${results.length} scenarios)${engineScenarioModule ? ' [engine-piloted]' : ''}`);
}
