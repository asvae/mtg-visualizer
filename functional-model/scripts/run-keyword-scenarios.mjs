// Runs every keyword/mechanic bundle's own scenarios.ts
// (functional-model/keywords/<bundle>/scenarios.ts) and writes its trace to
// that bundle's own trace.json — the keyword-suite mirror of
// run-scenarios.mjs, scoped to functional-model/keywords/ instead of
// functional-model/cards/. Every bundle here exports `runEngineScenarios()`
// only (no bundle uses the flat harness.ts `scenarios` array shape) — see
// functional-model/keywords/registry.ts's own header for why this tree is
// separate from, and not scanned by, run-scenarios.mjs/verify-synergy.mjs.
//
// Usage: npx vite-node functional-model/scripts/run-keyword-scenarios.mjs

import { readdir, writeFile } from 'node:fs/promises';

const keywordsDir = new URL('../keywords/', import.meta.url);
const entries = await readdir(keywordsDir, { withFileTypes: true });
const bundles = entries.filter((e) => e.isDirectory()).map((e) => e.name);

for (const bundle of bundles) {
  const scenariosModule = await import(`../keywords/${bundle}/scenarios.ts`).catch((err) => {
    console.error(`FAILED ${bundle}: ${err.message}`);
    return null;
  });
  if (!scenariosModule) continue;
  if (typeof scenariosModule.runEngineScenarios !== 'function') {
    console.log(`skip ${bundle}: no runEngineScenarios() export`);
    continue;
  }
  const results = scenariosModule.runEngineScenarios();
  const outPath = new URL(`../keywords/${bundle}/trace.json`, import.meta.url);
  await writeFile(outPath, JSON.stringify(results, null, 2) + '\n', 'utf8');
  console.log(`wrote keywords/${bundle}/trace.json (${results.length} scenarios)`);
}
