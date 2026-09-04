// Runs every card's own scenarios.ts through functional-model/harness.ts and
// writes the resulting fact log to that card's own trace.json — the
// per-card structure is: definition.ts (definition), scenarios.ts (test inputs,
// data), trace.json (test results, data — this script's output). A synergy
// matcher (see match.mjs) reads trace.json files, never re-runs anything.
//
// Usage: npx vite-node functional-model/scripts/run-scenarios.mjs

import { readdir, writeFile } from 'node:fs/promises';

const { runScenarios } = await import('../harness.ts');

const cardsDir = new URL('../cards/', import.meta.url);
const slugs = (await readdir(cardsDir, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name);

for (const slug of slugs) {
  const cardModule = await import(`../cards/${slug}/definition.ts`);
  const scenariosModule = await import(`../cards/${slug}/scenarios.ts`).catch(() => null);
  if (!scenariosModule) {
    console.log(`skip ${slug}: no scenarios.ts`);
    continue;
  }
  const card = Object.values(cardModule)[0];
  const results = runScenarios(card, scenariosModule.scenarios);
  const outPath = new URL(`../cards/${slug}/trace.json`, import.meta.url);
  await writeFile(outPath, JSON.stringify(results, null, 2) + '\n', 'utf8');
  console.log(`wrote cards/${slug}/trace.json (${results.length} scenarios)`);
}
