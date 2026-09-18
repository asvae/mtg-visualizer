import type { CardDefinition, Effect } from '../../card';

export const billowingShriekmass: CardDefinition = {
  name: 'Billowing Shriekmass',
  manaCost: '{3}{B}',
  typeLine: 'Creature — Spirit',
  pt: [2, 3],

  keywords: ['Flying'],

  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
      effects: [
        {
          kind: 'mill',
          owner: 'you',
          amount: 3,
        } satisfies Effect,
      ],
    },
  ],

  staticAbilities: [
    'Threshold — This creature gets +2/+1 as long as there are seven or more cards in your graveyard.',
  ],

  // Threshold condition: +2/+1 if 7+ cards in graveyard
  continuousPTGrants: [
    {
      power: 2,
      toughness: 1,
      includeSelf: true,
    },
  ],
};
