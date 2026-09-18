import type { CardDefinition, Effect } from '../../card';

export const goblinBoarders: CardDefinition = {
  name: 'Goblin Boarders',
  manaCost: '{2}{R}',
  typeLine: 'Creature — Goblin Pirate',
  pt: [3, 2],

  triggers: [
    {
      name: 'onEnterRaid',
      on: 'enter',
      effects: [
        {
          kind: 'putCounter',
          target: 'self',
          counterType: '+1/+1',
          amount: 1,
        } satisfies Effect,
      ],
    },
  ],
};
