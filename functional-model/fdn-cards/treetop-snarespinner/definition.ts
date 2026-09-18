import type { CardDefinition, Effect } from '../../card';

export const treetopSnarespinner: CardDefinition = {
  name: 'Treetop Snarespinner',
  manaCost: '{3}{G}',
  typeLine: 'Creature — Spider',
  pt: [1, 4],
  keywords: ['Reach', 'Deathtouch'],

  activationCost: '{2}{G}',
  effects: [{ kind: 'putCounterTarget', validType: 'creature', counterType: '+1/+1', amount: 1, owner: 'you', qty: 1 } satisfies Effect],
};
