import type { CardDefinition } from '../../card';

// Real script (clives_hideaway.txt): no `R:Event$ Moved ... ReplaceWith$
// ETBTapped` line — real Hideaway lands genuinely enter UNTAPPED (Hideaway
// itself is a look/exile effect, not a tap replacement). Every real ability
// fails to fit an existing declarative shape:
//  - Hideaway 4 (K:Hideaway:4, "look at the top four cards of your
//    library, exile ONE FACE DOWN, then put the rest on the bottom") is a
//    real onEnter library-manipulation trigger, but `dig` (the only library-
//    look effect kind) only ever sends its found cards to HAND — there is
//    no effect kind that exiles a card face down, so Hideaway's own real
//    shape can't be expressed.
//  - "{2}, {T}: You may play the exiled card without paying its mana cost
//    if you control four or more legendary creatures" needs BOTH a way to
//    reference "the card this permanent exiled via Hideaway" (nothing
//    tracks that) AND the explicitly out-of-scope "cast a card from
//    exile you didn't put there via alternateCosts" action (per this
//    batch's own known-gaps list) — a real gap on two independent counts.
//  - {T}: Add {C} is a real mana ability — no mana-producing Effect/Action
//    exists anywhere in this model, the documented STILL-DEFERRED gap.
// All three stay static text — there is no declarative onEnter/effects/
// abilities entry on this card at all.
export const clivesHideaway: CardDefinition = {
  name: "Clive's Hideaway",
  manaCost: '',
  typeLine: 'Land — Town',

  staticAbilities: [
    'Hideaway 4 (When this land enters, look at the top four cards of your library, exile one face down, then put the rest on the bottom in a random order.)',
    '{T}: Add {C}.',
    '{2}, {T}: You may play the exiled card without paying its mana cost if you control four or more legendary creatures.',
  ],
};
