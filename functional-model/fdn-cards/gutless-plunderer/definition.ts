import type { CardDefinition, Effect } from '../../card';

export const gutlessPlunderer: CardDefinition = {
  name: 'Gutless Plunderer',
  manaCost: '{2}{B}',
  typeLine: 'Creature — Skeleton Pirate',
  pt: [2, 2],

  keywords: ['Deathtouch'],

  // "Raid — When this creature enters, if you attacked this turn, look at
  // the top three cards of your library. You may put one of those cards
  // back on top of your library. Put the rest into your graveyard."
  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
      condition: { kind: 'attackedThisTurn' },
      effects: [
        {
          kind: 'dig',
          qty: 3,
          take: 1,
          optional: true,
        } satisfies Effect,
      ],
    },
  ],
};
