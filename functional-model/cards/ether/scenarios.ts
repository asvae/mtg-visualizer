import type { Scenario } from '../../harness';

// Single scenario, per the standing "default 1, real basic function" rule
// (SYNERGY_DESIGN.md, 2026-09-12 refinement) — this ability has exactly one
// real mode (no "Choose one," unlike phoenix-down/elixir's own identical
// "{T}, Exile this artifact: ..." cost shape). Demonstrates the only real,
// modeled half of the card: tap + exile self as its activation cost, add
// {U}. The delayed spell-copy half is a documented engine gap (see
// definition.ts) and isn't — can't be — shown here.
//
// Cost is genuinely unpilotable through `canActivateAbility`/
// `activateAbility` (engine.ts's own `unsupportedCostComponent` doesn't
// recognize "Exile this artifact" as a payable cost component at all — same
// wall phoenix-down's and elixir's own identical cost shape already hit),
// so this stays a plain `harness.ts` scenario (its own `effects` run
// directly) rather than an `engine-trace.ts` `ability`/`sequence` pilot.
export const scenarios: Scenario[] = [{ result: 'taps and exiles itself to add {U}' }];
