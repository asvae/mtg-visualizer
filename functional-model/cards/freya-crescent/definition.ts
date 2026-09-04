import type { CardDefinition } from '../../card';

// "Jump — During your turn, Freya Crescent has flying." — real Forge
// implements this as a CONDITIONAL static grant (`S:Mode$ Continuous |
// Condition$ PlayerTurn | AddKeyword$ Flying`), not a base `K:` line —
// same "Jump" shape card.ts's own `staticAbilities` doc comment already
// cites Kain, Traitorous Dragoon for (a granted static buff, not an
// always-on keyword), so this is text, not `keywords: ['Flying']`.
//
// "{T}: Add {R}. Spend this mana only to cast an Equipment spell or
// activate an equip ability." — a real, confirmed gap: no Effect kind or
// `Actions` method anywhere produces mana (state.ts's own header rules out
// anything beyond its stated action vocabulary; no mana pool is tracked at
// all). Omitted rather than approximated; flagged to the parent session.
export const freyaCrescent: CardDefinition = {
  name: 'Freya Crescent',
  manaCost: '{R}',
  typeLine: 'Legendary Creature — Rat Knight',

  pt: [1, 1],
  staticAbilities: ['Jump — During your turn, Freya Crescent has flying.'],
};
