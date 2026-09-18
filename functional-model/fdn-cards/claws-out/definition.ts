import type { CardDefinition, Effect } from '../../card';

export const clawsOut: CardDefinition = {
  name: 'Claws Out',
  manaCost: '{3}{W}{W}',
  typeLine: 'Instant',

  // Affinity for Cats (This spell costs {1} less to cast for each Cat you control.)
  costReduction: { perControlled: { amountPerMatch: 1, subtype: 'Cat' } },

  // Creatures you control get +2/+2 until end of turn.
  effects: [
    {
      kind: 'pumpAll',
      predicate: 'creatures-you-control',
      power: 2,
      toughness: 2,
      untilEndOfTurn: true,
    } satisfies Effect,
  ],

  // Coverage-justification manifest — moved out to a real, SPAN-VERIFIED
  // functional-model/fdn-cards/claws-out/justification.json (2026-09-18,
  // later still — the justification.json redesign, see
  // `.claude/contracts/card-schema.md`). No longer an inline field on
  // CardDefinition at all — see coverage-justification.ts's own header.
};
