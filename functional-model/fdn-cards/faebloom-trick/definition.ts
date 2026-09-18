import type { CardDefinition, Effect } from '../../card';

export const faebloomTrick: CardDefinition = {
  name: 'Faebloom Trick',
  manaCost: '{2}{U}',
  typeLine: 'Instant',

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
      amount: 2,
    } satisfies Effect,
    {
      kind: 'tapTarget',
      validType: 'creature',
      owner: 'opponents',
    } satisfies Effect,
  ],
};
