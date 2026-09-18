import type { CardDefinition } from '../../card';

export const inspiringPaladin: CardDefinition = {
  name: 'Inspiring Paladin',
  manaCost: '{2}{W}',
  typeLine: 'Creature — Human Knight',
  pt: [3, 3],

  // First ability: "During your turn, this creature has first strike." — modeled
  // via continuousKeywordGrants on self.
  //
  // Second ability: "During your turn, creatures you control with +1/+1 counters
  // on them have first strike." — CANNOT be expressed via current
  // continuousKeywordGrants vocabulary (which filters on subtype, self, or
  // Equipment attachment, not on counter state). Flagged as gap.
  staticAbilities: [
    'During your turn, this creature has first strike.',
    'During your turn, creatures you control with +1/+1 counters on them have first strike.',
  ],

  continuousKeywordGrants: [
    {
      includeSelf: true,
      onlyDuringYourTurn: true,
      keywords: ['FirstStrike'],
    },
  ],
};
