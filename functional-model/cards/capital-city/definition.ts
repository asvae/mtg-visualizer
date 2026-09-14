import type { CardDefinition, Effect } from '../../card';

// Real script (capital_city.txt): unlike every other Town in this batch,
// Capital City has NO `R:Event$ Moved ... ReplaceWith$ ETBTapped` line at
// all — it genuinely enters UNTAPPED.
//  - Both mana abilities (`{T}: Add {C}.`; `{1}, {T}: Add one mana of any
//    color.`) are now real, structured `manaAbilities` entries. The first
//    is an ordinary payable `{T}` source; the second's own `cost` genuinely
//    ISN'T a bare `{T}` (Cost$ 1 T) — real, typed, but deliberately
//    UNPAYABLE (`mana.ts`'s own `payableManaAbility` only recognizes a bare
//    `{T}` cost as ordinary — see that function's own doc comment: paying a
//    mana ability's OWN cost would need a real spendable mana-pool
//    mechanism this engine doesn't have at all).
//  - Cycling {2} (ENGINE_GAPS.md gap #23, closed 2026-09-14) is now a real,
//    structured, engine-piloted activated ability (`abilities`) — a genuine
//    602.1 activation FROM HAND, cost = {2} + discard this card itself
//    (`engine.ts`'s `costRequiresDiscardSelf`), resolving to a plain
//    `drawCard`. See cloudbound-moogle/definition.ts's own comment for the
//    full mechanism (TypeCycling's own search variant); this is the plain,
//    no-search Cycling shape.
export const capitalCity: CardDefinition = {
  name: 'Capital City',
  manaCost: '',
  typeLine: 'Land — Town',

  abilities: [{ name: 'cycling', cost: '{2}, Discard this card', effects: [{ kind: 'drawCard' } satisfies Effect] }],
  manaAbilities: [{ colors: ['C'] }, { cost: '{1}, {T}', colors: ['W', 'U', 'B', 'R', 'G'] }],
};
