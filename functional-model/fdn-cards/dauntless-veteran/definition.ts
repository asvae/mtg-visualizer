import type { CardDefinition, Effect } from '../../card';

export const dauntlessVeteran: CardDefinition = {
  name: 'Dauntless Veteran',
  provenance: 'forge-json-compiler',
  manaCost: '{1}{W}{W}',
  typeLine: 'Creature — Human Soldier',
  pt: [2, 2],
  triggers: [
    {
      name: 'onAttacks',
      cause: {
        on: 'attacks',
      },
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
