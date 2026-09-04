import type { CardDefinition } from '../../card';

export const noctisPrinceOfLucis: CardDefinition = {
  name: 'Noctis, Prince of Lucis',
  manaCost: '{1}{W}{U}{B}',
  typeLine: 'Legendary Creature — Human Noble',

  pt: [4, 3],
  keywords: ['Lifelink'],

  // "You may cast artifact spells from your graveyard by paying 3 life in
  // addition to paying their other costs. If you cast a spell this way,
  // that artifact enters with a finality counter on it." This grants a
  // casting PERMISSION to OTHER cards, not an alternate way Noctis itself
  // is cast — `CardDefinition.alternateCosts` only models a card's own
  // self-declared alternate cast mode (see card.ts's own doc comment), and
  // nothing here casts an arbitrary OTHER card from a graveyard at all (a
  // real, deliberate out-of-scope gap the parent's own list already names:
  // "no 'cast a card from graveyard/exile you didn't put there via
  // alternateCosts' action"). A real, continuous static permission —
  // `staticAbilities` text, never a resolvable `effects` step.
  staticAbilities: [
    'You may cast artifact spells from your graveyard by paying 3 life in addition to paying their other costs. If you cast a spell this way, that artifact enters with a finality counter on it.',
  ],
};
