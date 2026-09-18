import type { CardDefinition } from '../../card';

export const twinflameTyrant: CardDefinition = {
  name: 'Twinflame Tyrant',
  manaCost: '{3}{R}{R}',
  typeLine: 'Creature — Dragon',
  pt: [3, 5],
  keywords: ['Flying'],

  missingSchemaFunctionality: [
    {
      clause: 'If a source you control would deal damage to an opponent or a permanent an opponent controls, it deals double that damage instead.',
      demand:
        'Needs a real CR 614.2 damage-doubling replacement scoped to "damage YOU deal to an opponent/their permanents" — the existing `Keyword` union only has `LifegainDouble` (life-gain) and `TwoHeadedCoin` (coin flips), no outgoing-damage-doubling variant.',
    },
  ],
};
