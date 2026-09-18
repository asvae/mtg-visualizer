import type { CardDefinition, Effect } from '../../card';

export const cracklingCyclops: CardDefinition = {
  name: 'Crackling Cyclops',
  manaCost: '{2}{R}',
  typeLine: 'Creature — Cyclops Wizard',
  pt: [0, 4],

  // Whenever you cast a noncreature spell, this creature gets +3/+0 until end of turn.
  // NOTE: Trigger fires on spell-cast (noncreature only). The pump effect is clean.
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
