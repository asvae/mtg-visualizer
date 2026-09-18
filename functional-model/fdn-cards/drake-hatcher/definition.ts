import type { CardDefinition, Effect } from '../../card';

export const drakeHatcher: CardDefinition = {
  name: 'Drake Hatcher',
  manaCost: '{1}{U}',
  typeLine: 'Creature — Human Wizard',
  pt: [1, 3],

  keywords: ['Vigilance', 'Prowess'],

  // "Whenever this creature deals combat damage to a player, put that many
  // incubation counters on it."
  triggers: [
    {
      name: 'onCombatDamageToPlayer',
      effects: [
        {
          kind: 'putCounter',
          target: 'self',
          counterType: 'incubation',
          amount: (ctx) => (ctx.triggerInput?.damageAmount as number) ?? 0,
        } satisfies Effect,
      ],
    },
  ],

  activationCost: 'Remove three incubation counters from this creature',
  effects: [
    {
      kind: 'createToken',
      token: {
        name: 'Drake',
        manaCost: '0',
        types: ['Creature', 'Drake'],
        basePower: 2,
        baseToughness: 2,
        keywords: ['Flying'],
      },
      amount: 1,
    } satisfies Effect,
  ],
};
