import type { CardDefinition } from '../../card';

// Every real ability here fails to fit an existing declarative shape:
//  - The anthem ("Artifact creatures and Heroes you control get +1/+1 for
//    each Artificer...") needs an OR of two different subtype groups
//    (Artifact creatures + Heroes) with a dynamically-computed amount —
//    `pumpAll`'s own `predicate`/`subtype` only support ONE subtype filter
//    over 'creatures-you-control', no OR of two groups.
//  - "A deck can have any number of cards named CARDNAME" is a deck-
//    construction rule, not a resolvable/continuous game effect.
//  - Cycling is a real activated-from-hand ability — no `CardDefinition`
//    field models activation from hand (same gap hill-gigas' own
//    Mountaincycling comment already documents).
// All three stay static text.
export const cidTimelessArtificer: CardDefinition = {
  name: 'Cid, Timeless Artificer',
  manaCost: '{2}{W}{U}',
  typeLine: 'Legendary Creature — Human Artificer',

  pt: [4, 4],

  staticAbilities: [
    'Artifact creatures and Heroes you control get +1/+1 for each Artificer you control and each Artificer card in your graveyard.',
    'A deck can have any number of cards named Cid, Timeless Artificer.',
    'Cycling {W}{U} ({W}{U}, Discard this card: Draw a card.)',
  ],
};
