import type { CardDefinition, Effect } from '../../card';

export const cracklingCyclops: CardDefinition = {
  name: 'Crackling Cyclops',
  manaCost: '{2}{R}',
  typeLine: 'Creature — Cyclops Wizard',
  pt: [0, 4],

  triggers: [
    {
      name: 'NoncreatureSpellCast',
      effects: [
        {
          kind: 'pumpSelf',
          power: 3,
          toughness: 0,
          untilEndOfTurn: true,
        } satisfies Effect,
      ],
    },
  ],
};
