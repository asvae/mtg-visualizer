import type { Scenario } from '../../harness';

// No top-level `trigger` on the first scenario (same "mythical enter" fix
// already applied pool-wide — see ice-flan's/dragoon-s-lance's own
// scenarios.ts): a bare `trigger: 'onEnter'` would start `self` already on
// the Battlefield, skipping the real cast->resolve->enters lifecycle
// entirely, leaving the baseline `self-cast`/`self-enters` facts with no
// supporting trace line. `sequence: ['onEnter']` instead runs that real
// lifecycle FIRST (real `fn:'cast'`/`fn:'enters'` evidence), then fires the
// ETB trigger against the same shared GameState.
export const scenarios: Scenario[] = [
  // Real attach (`actions.equip`) + tap against the SAME chosen creature —
  // demonstrates the onEnter trigger's genuine two-step effect, not just the
  // tap half. The resulting `CantUntap` lockdown (`continuousKeywordGrants`,
  // definition.ts) isn't separately re-demonstrated here: `harness.ts`'s own
  // flat scenario runner never copies a `CardDefinition`'s
  // `continuousKeywordGrants` onto the `RealCard`s it builds (only
  // `engine.ts`'s real `castSpell`/`resolveTop` pilot path does that) — same
  // "real, structurally-wired mechanism, unit-tested at the engine level, not
  // proven live in this card's own flat scenario" treatment Dragoon's Lance's
  // own equivalent equipped-creature grants already get (see that card's own
  // `scenarios.ts`); real coverage lives in `state.test.ts`'s own
  // `CantUntap` describe block instead.
  { result: 'cast from hand, enters the battlefield, attaches to the enchanted creature and taps it', you: { creaturesCount: 1 }, sequence: ['onEnter'] },
  { result: 'sacrifices this Aura', trigger: 'onEnchantedDealtDamage' },
];
