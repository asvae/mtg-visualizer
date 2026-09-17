// Engine-capability status report — prints the same gray/purple/blue
// baseline `GET /api/engine-status` serves (see functional-model/
// engine-status.ts + .claude/contracts/engine-status-schema.md), off
// ENGINE_GAPS.md's own "Real gaps — prioritized" numbered list. A quick
// CLI check for whoever's touching that doc, or for a future card-
// authoring pipeline that wants this off-process rather than over HTTP.
//
// Usage: npx vite-node functional-model/scripts/compute-engine-status.mjs [--json]

import { computeEngineStatus } from '../engine-status.ts';

const entries = computeEngineStatus();

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(entries, null, 2));
} else {
  const counts = { gray: 0, purple: 0, blue: 0 };
  for (const e of entries) counts[e.baseline]++;
  console.log(`${entries.length} tracked gaps — blue ${counts.blue}, purple ${counts.purple}, gray ${counts.gray}\n`);
  for (const e of entries) {
    const badge = { blue: '[blue]  ', purple: '[purple]', gray: '[gray]  ' }[e.baseline];
    console.log(`${badge} #${e.gapNumber} ${e.title}`);
    if (e.evidence.testFiles.length) console.log(`         tests: ${e.evidence.testFiles.join(', ')}`);
    if (e.evidence.hasNamedRemainder) console.log(`         (names a real remainder still not modeled)`);
  }
}
