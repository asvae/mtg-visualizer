import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  // `PlayerState`/`setupPlayer` (harness.ts) has no way to seed a
  // creature-typed LIBRARY card (unlike `graveyardCreatureCount` for the
  // graveyard) — every generic library filler card is non-creature, so this
  // scenario can only demonstrate the mill itself, not the "creature cards
  // milled this way enter the battlefield" branch of `effects`'s own
  // `custom` code (which is otherwise correctly implemented — see
  // definition.ts). Flagged as a gap in the parent report.
  { result: 'mills 4 generic (noncreature) library cards to the graveyard; none qualify to enter the battlefield under this harness (see reported gap: no way to seed library creature cards)', castFrom: 'hand', you: { libraryCount: 6 } },
  { result: 'at the next end step, creature cards you control return to hand', trigger: 'atNextEndStep', you: { creaturesCount: 2 } },
];
