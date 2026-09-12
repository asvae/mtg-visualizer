import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  // ONE consolidated scenario (per paladin-s-arms's own 2026-09-12 fix,
  // same real shape): a top-level `trigger:'onEnter'` alone would skip the
  // automatic activate `harness.ts`'s `selfZone`/`lifecycleBefore` would
  // otherwise fire (this card's own `activationCost`, Equip {3}, means
  // NEITHER `scenario.trigger` NOR `scenario.ability` being set would
  // auto-activate instead — real cast/enters evidence can never coexist
  // with that path either way), losing real `read:getCreaturesInPlay`
  // evidence for the "wants a creature you control" sink. Chaining a real
  // Equip {3} activation via `sequence` after the Job select trigger gives
  // both real abilities their own real evidence in one continuous story:
  // Job select creates and attaches to a Hero token, then the real Equip
  // {3} activation re-attaches this Equipment to the other real creature
  // already on the battlefield (a real vanilla Grizzly Bears, present
  // BEFORE the trigger creates the Hero token, so it's `getCreaturesInPlay
  // ()`'s own first/default candidate — a genuinely different creature
  // from the one Job select already attached to, not a no-op re-target).
  {
    result:
      'Job select creates a 1/1 colorless Hero creature token and attaches itself to it, then an Equip {3} activation re-attaches it to the other creature already on the battlefield instead',
    trigger: 'onEnter',
    you: { creaturesCount: 1 },
    sequence: [{ activate: true }],
  },
];
