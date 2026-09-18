import type { CardDefinition, Effect } from '../../card';

export const vanguardSeraph: CardDefinition = {
  name: 'Vanguard Seraph',
  manaCost: '{3}{W}',
  typeLine: 'Creature — Angel Warrior',
  pt: [3, 3],
  keywords: ['Flying'],

  triggers: [
    {
      name: 'onFirstLifeGainedEachTurn',
      effects: [
        {
          kind: 'surveil',
          qty: 1,
        } satisfies Effect,
      ],
    },
  ],
};
