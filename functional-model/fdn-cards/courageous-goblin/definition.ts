import type { CardDefinition, Effect } from '../../card';

export const courageousGoblin: CardDefinition = {
  name: 'Courageous Goblin',
  manaCost: '{1}{R}',
  typeLine: 'Creature — Goblin',
  pt: [2, 2],

  triggers: [
    {
      name: 'AttackWithPowerGate',
      on: 'attacks',
      condition: { kind: 'controlsCreaturePowerAtLeast', min: 4 },
      effects: [
        {
          kind: 'pumpSelf',
          power: 1,
          toughness: 0,
          untilEndOfTurn: true,
        } satisfies Effect,
        {
          kind: 'grantKeywordSelf',
          keyword: 'Menace',
          untilEndOfTurn: true,
        } satisfies Effect,
      ],
    },
  ],
};
