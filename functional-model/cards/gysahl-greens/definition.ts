import type { CardDefinition, Effect } from '../../card';

export const gysahlGreens: CardDefinition = {
  name: 'Gysahl Greens',
  manaCost: '{1}{G}',
  typeLine: 'Sorcery',

  alternateCosts: [{ name: 'Flashback', cost: '{6}{G}', from: 'graveyard', thenExile: true }],

  effects: [
    // Real TokenScript$ g_2_2_bird_landfall — not in the shared tokens.ts
    // registry, so it's inlined the same way call-the-mountain-chocobo's
    // own copy of this exact token already does (off-limits to edit
    // tokens.ts for this batch). The token's own granted landfall pump
    // ability has no representable field on `TokenInfo`
    // (name/manaCost/types/basePower/baseToughness/keywords only — the
    // grant here isn't a real recognized Keyword) — real printed text,
    // lost the same way every other token's own granted non-keyword
    // ability is lost in this model.
    { kind: 'createToken', token: { name: 'Bird', manaCost: '0', types: ['Creature', 'Bird'], basePower: 2, baseToughness: 2 }, amount: 1 } satisfies Effect,
  ],
};
