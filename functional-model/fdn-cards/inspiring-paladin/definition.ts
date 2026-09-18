import type { CardDefinition } from '../../card';

export const inspiringPaladin: CardDefinition = {
  name: 'Inspiring Paladin',
  manaCost: '{2}{W}',
  typeLine: 'Creature — Human Knight',
  pt: [3, 3],

  missingSchemaFunctionality: [
    {
      clause: 'During your turn, creatures you control with +1/+1 counters on them have first strike.',
      demand: 'A COUNTER-PRESENCE-conditional variant of `continuousKeywordGrants` — the field\'s recipient filter today only supports subtype/self/Equipment-attachment, never "has a counter of type X on it" as the qualifying condition.',
    },
  ],

  // "During your turn, this creature has first strike."
  continuousKeywordGrants: [
    {
      includeSelf: true,
      onlyDuringYourTurn: true,
      keywords: ['FirstStrike'],
    },
  ],
};
