import type { CardDefinition, Effect } from '../../card';

export const joustThrough: CardDefinition = {
  name: 'Joust Through',
  manaCost: '{W}',
  typeLine: 'Instant',

  effects: [
    {
      kind: 'dealDamageTarget',
      amount: 3,
    } satisfies Effect,
    {
      kind: 'gainLife',
      amount: 1,
    } satisfies Effect,
  ],
};
