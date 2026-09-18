import type { CardDefinition, Effect } from '../../card';

export const boltwave: CardDefinition = {
  name: 'Boltwave',
  manaCost: '{R}',
  typeLine: 'Sorcery',

  effects: [
    {
      kind: 'dealDamage',
      target: 'opponents',
      amount: 3,
    } satisfies Effect,
  ],
};
