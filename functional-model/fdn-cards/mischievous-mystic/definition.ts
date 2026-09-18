import type { CardDefinition, Effect } from '../../card';

export const mischiefousMystic: CardDefinition = {
  name: 'Mischievous Mystic',
  manaCost: '{1}{U}',
  typeLine: 'Creature — Human Wizard',
  pt: [2, 1],
  keywords: ['Flying'],

  triggers: [
    {
      name: 'onSecondDraw',
      effects: [
        {
          kind: 'createToken',
          token: {
            name: 'Faerie',
            manaCost: '0',
            types: ['Creature', 'Faerie'],
            basePower: 1,
            baseToughness: 1,
            keywords: ['Flying'],
          },
          amount: 1,
        } satisfies Effect,
      ],
    },
  ],
};
