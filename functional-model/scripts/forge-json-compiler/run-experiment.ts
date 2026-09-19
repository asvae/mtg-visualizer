/**
 * Standalone CLI runner — compile the real Forge JSON for each card below
 * and structurally diff it against that card's hand-authored, Forge-
 * audited `fdn-cards/<slug>/definition.ts`. Predates (and is now largely
 * superseded by) `fdn-1-50.test.ts`'s own 50-card regression guard; kept
 * as a small, real, non-`vitest` entry point for a quick one-off compile +
 * eyeball diff.
 *
 *   npx vite-node functional-model/scripts/forge-json-compiler/run-experiment.ts
 *
 * Read-only w.r.t. everything outside this directory.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { CardDefinition } from '../../card';
import { compileForgeCard, type ForgeJsonCard } from './compile-forge-card';
import { structuralDiff } from './diff';
import { exemplarOfLight } from '../../fdn-cards/exemplar-of-light/definition';
import { fleetingFlight } from '../../fdn-cards/fleeting-flight/definition';

const CASES: { forgeFile: string; slug: string; authored: CardDefinition }[] = [
  { forgeFile: 'exemplar_of_light.json', slug: 'exemplar-of-light', authored: exemplarOfLight },
  { forgeFile: 'fleeting_flight.json', slug: 'fleeting-flight', authored: fleetingFlight },
];

let anyDiff = false;
for (const testCase of CASES) {
  const forgeJsonPath = resolve(import.meta.dirname, '../experiments/forge-json-mapper/output/', testCase.forgeFile);
  const forgeJson = JSON.parse(readFileSync(forgeJsonPath, 'utf8')) as ForgeJsonCard;
  const compiled = compileForgeCard(forgeJson);

  console.log(`--- COMPILED CardDefinition (${testCase.slug}) ------------------`);
  console.log(JSON.stringify(compiled, null, 2));
  console.log(`--- DIFF vs hand-authored ${testCase.slug}/definition.ts -------`);
  const diffs = structuralDiff(compiled, testCase.authored);
  if (diffs.length === 0) console.log('EXACT STRUCTURAL MATCH');
  else {
    anyDiff = true;
    for (const d of diffs) console.log(`  ${d}`);
  }
  console.log('');
}

console.log(anyDiff ? 'RESULT: at least one card diverged (see above).' : 'RESULT: every card matched exactly.');
