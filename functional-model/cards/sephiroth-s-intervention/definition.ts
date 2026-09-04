import type { CardDefinition, Effect } from '../../card';

export const sephirothsIntervention: CardDefinition = {
  name: "Sephiroth's Intervention",
  manaCost: '{3}{B}',
  typeLine: 'Instant',

  effects: [
    { kind: 'destroy', validType: 'creature', qty: 1 } satisfies Effect,
    { kind: 'gainLife', amount: 2 } satisfies Effect,
  ],
};
