import type { CardDefinition, Effect } from '../../card';

export const courageousGoblin: CardDefinition = {
  name: 'Courageous Goblin',
  manaCost: '{1}{R}',
  typeLine: 'Creature — Goblin',
  pt: [2, 2],

  missingSchemaFunctionality: [
    {
      clause: 'while you control a creature with power 4 or greater',
      demand:
        'No `BoardStateCondition` kind covers a live-board POWER threshold on the controller\'s OWN creatures ("do you control a creature with power >= N") — the existing 3 kinds (`graveyardCountAtLeast`/`attackedThisTurn`/`selfCounterCountAtLeast`) cover graveyard count, raid, and self counter count only, none of which is this gate.',
    },
  ],

  triggers: [
    {
      name: 'AttackWithPowerGate',
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
