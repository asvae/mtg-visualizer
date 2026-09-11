// CLI wrapper around `scenario-card-names.mjs`'s `findFabricatedScenarioCardNames`
// — see that file's own header for scope/rationale. This is the manual,
// human-readable report; `functional-model/scenario-card-names.test.ts` is
// the version wired into `npm run test` so this can't bitrot into a
// one-off script nobody runs again (the exact fate the project's earlier
// `.tmp-check-images.mjs` scratch script had).
//
// Usage: node functional-model/scripts/verify-scenario-card-names.mjs
// (plain Node — no TS import needed, so no vite-node required, unlike
// verify-synergy.mjs which does import a .ts module for mana-color parsing.)
// Nonzero exit iff any fabricated name is found.

import { findFabricatedScenarioCardNames } from './scenario-card-names.mjs';

const cardsDir = new URL('../cards/', import.meta.url);
const dataDir = new URL('../../data/', import.meta.url);

const violations = await findFabricatedScenarioCardNames({ cardsDir, dataDir });

if (violations.length === 0) {
  console.log('OK — every addCard(...) literal name in every cards/*/scenarios.ts is a real Scryfall card.');
  process.exit(0);
}

console.log(`${violations.length} fabricated scenario card name(s) found:\n`);
for (const v of violations) {
  console.log(`  ✗ ${v.file}:${v.line} — name: '${v.name}' is not a real Scryfall card (checked data/*/*_scryfall.json)`);
}
console.log(`\n${violations.length} violation(s) — fix by naming a real, non-token card (see .claude CLAUDE.md's "scenario replay: real not mocked" rule).`);
process.exit(1);
