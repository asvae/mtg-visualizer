import type { Scenario } from '../../harness';

// A real branching modal ability — two genuinely mutually-exclusive modes
// that can't both be shown in one continuous story, so exactly one scenario
// per real mode (2026-09-12, per the standing "more than 1 scenario only for
// a very significant reason" rule) rather than either an artificial
// single-scenario consolidation or the extra no-op variants this file used
// to carry (dropped: they never called moveTo/tap at all with an empty
// pool, so they added zero real trace evidence beyond what these two
// already provide).
export const scenarios: Scenario[] = [
  { result: 'returns a creature card from graveyard to the battlefield tapped', mode: 0, you: { graveyardCreatureCount: 2 } },
  // Real regression fix (2026-09-12) — the old `creatureSubtypes: ['Zombie']`
  // filter tagged the shared, real, imageless-otherwise `GENERIC_FILLER_
  // CREATURE` ("Grizzly Bears," a real, specific, non-Zombie Scryfall card)
  // with a subtype it doesn't actually have — a real "not mocked" violation
  // caught live by the user: "exiles grizzly bear as a zombie (even though
  // it's not a zombie...)". Fixed via `creatureCards` (harness.ts's own new
  // field, added specifically for this): a real, specifically-named Zombie
  // (Qutrub Forayer, data/fin/fin_scryfall.json — Creature — Zombie Horror,
  // 3/2), not a mislabeled bear.
  { result: 'exiles the Zombie', mode: 1, opponents: [{ creatureCards: [{ name: 'Qutrub Forayer', subtypes: ['Zombie', 'Horror'], power: 3, toughness: 2 }] }] },
];
