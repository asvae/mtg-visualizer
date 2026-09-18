import type { CardDefinition, Effect } from '../../card';

export const komaWorldEater: CardDefinition = {
  name: 'Koma, World-Eater',
  manaCost: '{3}{G}{G}{U}{U}',
  typeLine: 'Legendary Creature — Serpent',
  pt: [8, 12],
  keywords: ['Trample', 'Ward'],

  triggers: [
    {
      name: 'onCombatDamageToPlayer',
      effects: [
        {
          kind: 'createToken',
          token: { name: "Koma's Coil", manaCost: '0', types: ['Creature', 'Serpent'], basePower: 3, baseToughness: 3 },
          amount: 4,
        } satisfies Effect,
      ],
    },
  ],

  missingSchemaFunctionality: [
    {
      clause: "This spell can't be countered.",
      demand: 'No counterspell-prevention/protection mechanism exists anywhere in this engine — no Stack-object model for a spell to become immune to being countered.',
    },
  ],
};
