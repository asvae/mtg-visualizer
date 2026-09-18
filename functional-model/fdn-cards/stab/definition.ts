import type { CardDefinition, Effect } from '../../card';

export const stab: CardDefinition = {
  name: 'Stab',
  manaCost: '{B}',
  typeLine: 'Instant',

  effects: [
    {
      kind: 'pumpTarget',
      power: -2,
      toughness: -2,
      untilEndOfTurn: true,
    } satisfies Effect,
  ],
};
