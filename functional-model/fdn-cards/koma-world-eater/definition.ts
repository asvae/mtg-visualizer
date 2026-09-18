import type { CardDefinition, Effect } from '../../card';

// Real Forge (koma_world_eater.txt): `R:Event$ Counter | ValidCard$
// Card.Self | ValidSA$ Spell | Layer$ CantHappen` — "this spell can't be
// countered." No counterspell-prevention/protection mechanism exists
// anywhere in this engine (there's no Stack-object counter-targeting model
// at all — `kind:'counter'` is a log-only effect for the ACT of countering
// something else, never a target-side immunity).
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
