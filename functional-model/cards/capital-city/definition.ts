import type { CardDefinition } from '../../card';

// Real script (capital_city.txt): unlike every other Town in this batch,
// Capital City has NO `R:Event$ Moved ... ReplaceWith$ ETBTapped` line at
// all — it genuinely enters UNTAPPED. Every real ability it has fails to
// fit an existing declarative shape:
//  - Both mana abilities ({T}: Add {C}; {1},{T}: Add one mana of any
//    color) are real mana-producing abilities — no mana-producing
//    Effect/Action exists anywhere in this model (no mana pool tracked), a
//    documented, deliberate STILL-DEFERRED gap.
//  - Cycling {2} is a real activated-FROM-HAND ability (discard this card,
//    pay {2}: draw a card) — no `CardDefinition` field models activation
//    from hand (same gap hill-gigas' own Mountaincycling and cid-timeless-
//    artificer's own Cycling comments already document).
// All three stay static text — there is no declarative onEnter/effects/
// abilities entry on this card at all.
export const capitalCity: CardDefinition = {
  name: 'Capital City',
  manaCost: '',
  typeLine: 'Land — Town',

  staticAbilities: ['{T}: Add {C}.', '{1}, {T}: Add one mana of any color.', 'Cycling {2} ({2}, Discard this card: Draw a card.)'],
};
