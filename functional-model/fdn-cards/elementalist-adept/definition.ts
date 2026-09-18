import type { CardDefinition } from '../../card';

export const elementalistAdept: CardDefinition = {
  name: 'Elementalist Adept',
  manaCost: '{1}{U}',
  typeLine: 'Creature — Human Wizard',
  pt: [2, 1],

  // Real K:Flash, K:Prowess. "Prowess" is not in this model's controlled
  // `Keyword` vocabulary — same real gap drake-hatcher/queen-brahne's own
  // definition.ts already document (card.ts's own `Keyword` union has no
  // 'Prowess' entry; no "whenever you cast a noncreature spell" auto-fire
  // hook exists anywhere in this engine), so it stays real printed text
  // instead of a fabricated union member.
  keywords: ['Flash'],
  // Migrated from `staticAbilities` to `missingSchemaFunctionality`
  // (2026-09-18, FDN schema-tightness redesign).
  missingSchemaFunctionality: [
    {
      clause: 'Prowess (Whenever you cast a noncreature spell, this creature gets +1/+1 until end of turn.)',
      demand: "A real `Prowess` `Keyword` union member PLUS the matching auto-fire hook — no \"whenever you cast a noncreature spell\" trigger precondition exists anywhere in this engine for ANY card (same real gap Drake Hatcher's own identical Prowess line also names).",
    },
  ],
};
