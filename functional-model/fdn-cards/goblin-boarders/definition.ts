import type { CardDefinition, Effect } from '../../card';

export const goblinBoarders: CardDefinition = {
  name: 'Goblin Boarders',
  manaCost: '{2}{R}',
  typeLine: 'Creature — Goblin Pirate',
  pt: [3, 2],

  // Raid — This creature enters with a +1/+1 counter on it if you attacked this turn.
  // NOTE: The raid condition (check if you attacked this turn) gates the effect.
  // The putCounter effect itself is clean. Raid gating awaits scenario/engine support.
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
