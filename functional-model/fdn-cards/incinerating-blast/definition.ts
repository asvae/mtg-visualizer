import type { CardDefinition, Effect } from '../../card';

export const incineratingBlast: CardDefinition = {
  name: 'Incinerating Blast',
  manaCost: '{4}{R}',
  typeLine: 'Sorcery',

  effects: [
    {
      kind: 'dealDamageTarget',
      amount: 6,
    } satisfies Effect,
  ],
};
