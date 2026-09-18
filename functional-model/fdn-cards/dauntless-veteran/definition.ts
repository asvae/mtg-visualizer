import type { CardDefinition, Effect } from '../../card';

export const dauntlessVeteran: CardDefinition = {
  name: 'Dauntless Veteran',
  manaCost: '{1}{W}{W}',
  typeLine: 'Creature — Human Soldier',
  pt: [2, 2],

  // Whenever this creature attacks, creatures you control get +1/+1 until end of turn.
  triggers: [
    {
      name: 'onAttack',
      on: 'attacks',
      effects: [
        {
          kind: 'pumpAll',
          predicate: 'creatures-you-control',
          power: 1,
          toughness: 1,
          untilEndOfTurn: true,
        } satisfies Effect,
      ],
    },
  ],
};
