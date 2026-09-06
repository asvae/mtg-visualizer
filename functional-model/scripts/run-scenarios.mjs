// Runs every card's own scenarios.ts and writes the resulting fact log to
// that card's own trace.json — the per-card structure is: definition.ts
// (definition), scenarios.ts (test inputs, data), trace.json (test results,
// data — this script's output). A synergy matcher (see match.mjs) reads
// trace.json files, never re-runs anything.
//
// scenarios.ts is one of two shapes:
//   - exports `scenarios` (a Scenario[]) — run through harness.ts's
//     `runScenarios(card, scenarios)`, the flat named-trigger path.
//   - exports `runEngineScenarios(): TraceResult[]` — a REAL engine-piloted
//     trace (see engine-trace.ts's own header), called directly. Both
//     shapes produce the same TraceResult[], so nothing downstream needs to
//     know which one a given card uses.
//
// Usage: npx vite-node functional-model/scripts/run-scenarios.mjs

import { readdir, writeFile } from 'node:fs/promises';

const { runScenarios } = await import('../harness.ts');

const cardsDir = new URL('../cards/', import.meta.url);
const slugs = (await readdir(cardsDir, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name);

for (const slug of slugs) {
  const scenariosModule = await import(`../cards/${slug}/scenarios.ts`).catch(() => null);
  if (!scenariosModule) {
    console.log(`skip ${slug}: no scenarios.ts`);
    continue;
  }
  let results;
  let enginePiloted = false;
  if (typeof scenariosModule.runEngineScenarios === 'function') {
    results = scenariosModule.runEngineScenarios();
    enginePiloted = true;
  } else {
    const cardModule = await import(`../cards/${slug}/definition.ts`);
    const card = Object.values(cardModule)[0];
    results = runScenarios(card, scenariosModule.scenarios);
  }
  const outPath = new URL(`../cards/${slug}/trace.json`, import.meta.url);
  await writeFile(outPath, JSON.stringify(results, null, 2) + '\n', 'utf8');
  console.log(`wrote cards/${slug}/trace.json (${results.length} scenarios)${enginePiloted ? ' [engine-piloted]' : ''}`);
}
