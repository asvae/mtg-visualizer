import type { CardDefinition, Effect } from '../../card';

export const eagerTrufflesnout: CardDefinition = {
  name: 'Eager Trufflesnout',
  manaCost: '{2}{G}',
  typeLine: 'Creature — Boar',
  pt: [4, 2],
  keywords: ['Trample'],

  triggers: [
    {
      name: 'onCombatDamageToPlayer',
      effects: [
        {
          kind: 'createToken',
          token: { name: 'Food', manaCost: '0', types: ['Artifact', 'Food'], basePower: 0, baseToughness: 0 },
          amount: 1,
        } satisfies Effect,
      ],
    },
  ],
};
