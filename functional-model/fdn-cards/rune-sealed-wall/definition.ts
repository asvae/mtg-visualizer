import type { CardDefinition } from '../../card';

export const runeSealedWall: CardDefinition = {
  name: 'Rune-Sealed Wall',
  manaCost: '{2}{U}',
  typeLine: 'Artifact Creature — Wall',
  pt: [0, 6],
  keywords: ['Defender'],
  activationCost: '{T}',
  effects: [
    {
      kind: 'surveil',
      qty: 1,
    },
  ],
};
