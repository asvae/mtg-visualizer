import type { CardDefinition, Effect } from '../../card';

export const gorehornRaider: CardDefinition = {
  name: 'Gorehorn Raider',
  manaCost: '{4}{R}',
  typeLine: 'Creature — Minotaur Pirate',
  pt: [4, 4],

  // Raid — When this creature enters, if you attacked this turn, this creature deals 2 damage to any target.
  // NOTE: The raid condition (check if you attacked this turn) gates the effect.
  // The dealDamageAnyTarget effect itself is clean. Raid gating awaits scenario/engine support.
  triggers: [
    {
      name: 'onEnterRaid',
      on: 'enter',
      effects: [
        {
          kind: 'dealDamageAnyTarget',
          amount: 2,
        } satisfies Effect,
      ],
    },
  ],
};
