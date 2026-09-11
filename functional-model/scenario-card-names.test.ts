// Wires `scripts/scenario-card-names.mjs`'s check into the project's real
// `npm run test` path (`vitest run`) — not just a manually-run CLI script,
// which is exactly how the project's own earlier one-off
// `.tmp-check-images.mjs` scratch check bitrotted after a single
// investigation (per this task's own dispatch). A fabricated board-filler
// permanent name (invented, no real Scryfall card behind it — e.g. "Ally
// Legend") is a straight authoring-rule violation, not a soft note, so this
// test HARD FAILS (not `console.warn`/`it.skip`) whenever the pool has one —
// see `scripts/scenario-card-names.mjs`'s own header for exactly what is and
// isn't in scope (only literal `addCard(...)` names; `tokens:` catalog
// entries are legitimately synthetic and excluded).
//
// Expected to be RED as of 2026-09-11 (four known fabricated names already
// flagged in `.claude/agent-memory/engine/notes.md`) — fixing them is a
// separate, already-scoped follow-up task, not this one. This test's job is
// only to make sure the pool can never silently grow a FIFTH one unnoticed.
import { describe, expect, it } from 'vitest';
// `scenario-card-names.mjs` is deliberately plain JS, not `.ts` — both
// `verify-scenario-card-names.mjs` and `verify-synergy.mjs` import it under
// plain `node`/`vite-node` with no build step, so it can't gain a type-only
// dependency. This DOES mean `tsc --noEmit` reports one known, harmless
// TS7016 "could not find a declaration file" here (same "inert to runtime,
// small visible tsc-count delta" class of quirk already documented
// elsewhere in this pool, e.g. `synergy.test.ts`'s own tolerated
// excess-property-check false positive) — the `: ScenarioCardNameViolation[]`
// annotation below still gets the REST of this file real type-checking.
import { findFabricatedScenarioCardNames, type ScenarioCardNameViolation } from './scripts/scenario-card-names.mjs';

describe('scenario card names — every addCard(...) literal name is a real Scryfall card', () => {
  it('has no fabricated (non-token) board-filler names', async () => {
    const cardsDir = new URL('cards/', import.meta.url);
    const dataDir = new URL('../data/', import.meta.url);
    const violations: ScenarioCardNameViolation[] = await findFabricatedScenarioCardNames({ cardsDir, dataDir });
    const summary = violations.map((v) => `${v.file}:${v.line} — name: '${v.name}'`).join('\n');
    expect(violations, `Fabricated scenario card name(s) found (not real Scryfall cards):\n${summary}`).toEqual([]);
  });
});
