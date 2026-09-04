// Groups pool.json (see pool-traces.mjs) by a normalized key and reports
// EVERY cross-card match in the whole pool (unlike functional-model/synergy.ts's
// own findInteractionsForCard, which scopes to one card — this script is the
// whole-pool overview, now wired live into the Interactions panel via
// server/api/card/[set]/[number].ts). factsFor/sideOf now live in
// functional-model/synergy.ts (the real, importable module both this script
// and the live server route use) — imported here, not duplicated, so the
// two can never drift apart.
//
// Usage: npx vite-node functional-model/scripts/pool-traces.mjs && \
//        npx vite-node functional-model/scripts/find-synergies.mjs

import { readFile } from 'node:fs/promises';
import { factsFor } from '../synergy.ts';

const pool = JSON.parse(await readFile(new URL('../pool.json', import.meta.url), 'utf8'));

// key -> { producers: Set<card>, wanters: Set<card> }
const byKey = new Map();
for (const entry of pool) {
  for (const { role, key } of factsFor(entry)) {
    if (!byKey.has(key)) byKey.set(key, { producers: new Set(), wanters: new Set() });
    byKey.get(key)[role === 'produces' ? 'producers' : 'wanters'].add(entry.card);
  }
}

console.log(`Pool: ${pool.length} entries. Keys with signal: ${byKey.size}.\n`);
console.log('=== Cross-card matches (producer != wanter) ===');
let found = 0;
for (const [key, { producers, wanters }] of byKey) {
  for (const producer of producers) {
    for (const wanter of wanters) {
      if (producer === wanter) continue;
      console.log(`${producer} --[${key}]--> ${wanter}`);
      found++;
    }
  }
}
if (!found) console.log('(none found)');
