import type { CardDefinition, Effect } from '../../card';

export const laughingMad: CardDefinition = {
  name: 'Laughing Mad',
  manaCost: '{2}{R}',
  typeLine: 'Instant',

  // Real "As an additional cost to cast this spell, discard a card" is a
  // COST paid at cast time, not a resolution effect — `effects` means "what
  // happens when this resolves" (see card.ts's own CardDefinition.effects
  // doc comment), so it doesn't belong here, same reasoning every other
  // card's own mana cost/equip cost never shows up as an `Effect` either.
  alternateCosts: [{ name: 'Flashback', cost: '{3}{R}', from: 'graveyard', thenExile: true }],

  effects: [{ kind: 'drawCard', amount: 2 } satisfies Effect],
};
