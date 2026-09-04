import type { CardDefinition, Effect } from '../../card';

export const queenBrahne: CardDefinition = {
  name: 'Queen Brahne',
  manaCost: '{2}{R}',
  typeLine: 'Legendary Creature — Human Noble',

  pt: [2, 1],

  // Real K:Prowess — not in this model's controlled `Keyword` vocabulary
  // (card.ts's own `Keyword` union has no 'Prowess' entry), so it stays
  // real printed text here rather than a fabricated union member; exactly
  // the fallback card.ts's own CardDefinition.staticAbilities doc comment
  // describes for "a real Forge K:/S: line not yet in the controlled list."
  staticAbilities: ['Prowess (Whenever you cast a noncreature spell, this creature gets +1/+1 until end of turn.)'],

  triggers: [
    {
      name: 'onAttack',
      effects: [
        {
          kind: 'createToken',
          // Same real TokenScript$ b_0_1_wizard_snipe as Mysidian Elder's
          // own ETB — built inline for the same reason (not in the shared
          // TOKENS registry, off-limits to edit for this batch).
          token: { name: 'Wizard', manaCost: '0', types: ['Creature', 'Wizard'], basePower: 0, baseToughness: 1 },
          amount: 1,
        } satisfies Effect,
      ],
    },
  ],
};
