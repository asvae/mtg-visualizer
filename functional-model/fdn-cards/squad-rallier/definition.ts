import type { CardDefinition, Effect } from '../../card';

export const squadRallier: CardDefinition = {
  name: 'Squad Rallier',
  manaCost: '{3}{W}',
  typeLine: 'Creature — Human Scout',
  pt: [3, 4],

  // Activated ability: "{2}{W}: Look at the top four cards of your library.
  // You may reveal a creature card with power 2 or less from among them and
  // put it into your hand. Put the rest on the bottom of your library in a
  // random order."
  // GAP: The `dig` effect does not support power-based filtering (power <= 2).
  // Current vocabulary: validType can be 'artifact'/'any'/'creature-or-artifact'
  // but no numeric power constraint.
  activationCost: '{2}{W}',
  effects: [
    {
      kind: 'dig',
      qty: 4,
      take: 1,
      validType: 'creature-or-artifact',
      optional: true,
    } satisfies Effect,
  ],
};
