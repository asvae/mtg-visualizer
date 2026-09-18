import type { CardDefinition, Effect } from '../../card';

export const gorehornRaider: CardDefinition = {
  name: 'Gorehorn Raider',
  manaCost: '{4}{R}',
  typeLine: 'Creature — Minotaur Pirate',
  pt: [4, 4],

  triggers: [
    {
      name: 'onEnterRaid',
      on: 'enter',
      condition: { kind: 'attackedThisTurn' },
      effects: [
        {
          kind: 'dealDamageAnyTarget',
          amount: 2,
        } satisfies Effect,
      ],
    },
  ],
};
