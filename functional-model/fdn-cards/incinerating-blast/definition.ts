import type { CardDefinition, Effect } from '../../card';

// FLAG: Optional discard gating conditional draw (capacity gap)
// Real card ability: Incinerating Blast deals 6 damage to target creature.
// You may discard a card. If you do, draw a card.
//
// Missing infrastructure:
// (1) Optional discard offer (player choice)
// (2) Conditional effect chaining (if player chose to discard, then draw)

export const incineratingBlast: CardDefinition = {
  name: 'Incinerating Blast',
  manaCost: '{4}{R}',
  typeLine: 'Sorcery',

  effects: [
    {
      kind: 'dealDamageTarget',
      amount: 6,
    } satisfies Effect,
  ],
};
