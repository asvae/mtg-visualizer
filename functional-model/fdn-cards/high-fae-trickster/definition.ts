import type { CardDefinition } from '../../card';

export const highFaeTrickster: CardDefinition = {
  name: 'High Fae Trickster',
  manaCost: '{3}{U}',
  typeLine: 'Creature — Faerie Wizard',
  pt: [4, 2],

  keywords: ['Flash', 'Flying'],

  // Real Forge: S:Mode$ CastWithFlash | ValidCard$ Card | ValidSA$ Spell | Caster$ You
  // "You may cast spells as though they had flash."
  // The vocabulary has no way to express static abilities that affect casting mechanics
  // or broadcast keyword grants for casting timing. Flagged in final report.
};
