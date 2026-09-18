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
  staticAbilities: ['Prowess (Whenever you cast a noncreature spell, this creature gets +1/+1 until end of turn.)'],
};
