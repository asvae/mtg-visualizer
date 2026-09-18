import type { CardDefinition, Effect } from '../../card';

export const sowerOfChaos: CardDefinition = {
  name: 'Sower of Chaos',
  manaCost: '{3}{R}',
  typeLine: 'Creature — Devil',
  pt: [4, 3],

  activationCost: '{2}{R}',
  effects: [
    {
      kind: 'grantKeywordTarget',
      keyword: 'CantBlock',
      validType: 'creature',
      untilEndOfTurn: true,
    } satisfies Effect,
  ],
};
