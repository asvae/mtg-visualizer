import type { CardDefinition, Effect } from '../../card';

export const courageousGoblin: CardDefinition = {
  name: 'Courageous Goblin',
  manaCost: '{1}{R}',
  typeLine: 'Creature — Goblin',
  pt: [2, 2],

  // Whenever this creature attacks while you control a creature with power 4 or greater,
  // this creature gets +1/+0 and gains menace until end of turn.
  // NOTE: The conditional gate (power >= 4 control check) is a Forge-side condition
  // not yet modeled in CardDefinition. The effects themselves are clean.
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
