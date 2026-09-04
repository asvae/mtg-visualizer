import type { CardDefinition, Effect } from '../../card';

export const lockeCole: CardDefinition = {
  name: 'Locke Cole',
  manaCost: '{1}{U}{B}',
  typeLine: 'Legendary Creature — Human Rogue',

  pt: [2, 3],
  keywords: ['Deathtouch', 'Lifelink'],

  triggers: [
    {
      name: 'onDealsCombatDamageToPlayer',
      effects: [{ kind: 'drawCard' } satisfies Effect, { kind: 'discard', owner: 'you', qty: 1 } satisfies Effect],
    },
  ],
};
