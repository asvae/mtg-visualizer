import type { CardDefinition, Effect } from '../../card';

export const kaitoCunningInfiltrator: CardDefinition = {
  name: 'Kaito, Cunning Infiltrator',
  manaCost: '{1}{U}{U}',
  typeLine: 'Legendary Planeswalker — Kaito',

  missingSchemaFunctionality: [
    {
      clause: 'You get an emblem with "Whenever a player casts a spell, you create a 2/1 blue Ninja creature token."',
      demand: 'No emblem mechanic (CR 701.42 — a persistent, ownerless game object carrying its own triggered ability) exists anywhere in this engine.',
    },
  ],

  triggers: [
    {
      name: 'onCombatDamageToPlayer',
      effects: [{ kind: 'putCounter', target: 'self', counterType: 'loyalty', amount: 1 } satisfies Effect],
    },
  ],

  abilities: [
    {
      name: '+1',
      cost: 'Loyalty: +1',
      effects: [
        { kind: 'grantKeywordTarget', keyword: 'Unblockable', validType: 'creature', owner: 'you', untilEndOfTurn: true } satisfies Effect,
        { kind: 'drawCard', amount: 1 } satisfies Effect,
        { kind: 'discard', owner: 'you', qty: 1 } satisfies Effect,
      ],
    },
    {
      name: '-2',
      cost: 'Loyalty: -2',
      effects: [
        {
          kind: 'createToken',
          token: { name: 'Ninja', manaCost: '0', types: ['Creature', 'Ninja'], basePower: 2, baseToughness: 1 },
          amount: 1,
        } satisfies Effect,
      ],
    },
    {
      name: '-9',
      cost: 'Loyalty: -9',
      effects: [
        {
          kind: 'custom',
          describe:
            'you get an emblem with "Whenever a player casts a spell, you create a 2/1 blue Ninja creature token." (no emblem mechanic exists anywhere in this engine)',
          run: () => {},
        } satisfies Effect,
      ],
    },
  ],
};
