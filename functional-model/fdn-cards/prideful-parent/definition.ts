import type { CardDefinition, Effect } from '../../card';

export const pridefulParent: CardDefinition = {
  name: 'Prideful Parent',
  manaCost: '{2}{W}',
  typeLine: 'Creature — Cat',
  pt: [2, 2],
  keywords: ['Vigilance'],

  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
      effects: [
        {
          kind: 'createToken',
          token: {
            name: 'Cat',
            manaCost: '',
            types: ['Creature', 'Cat'],
            basePower: 1,
            baseToughness: 1,
          },
          amount: 1,
        } satisfies Effect,
      ],
    },
  ],
};
