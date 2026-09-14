import type { CardDefinition, Effect } from '../../card';

// Two of these three real abilities still fail to fit an existing
// declarative shape:
//  - The anthem ("Artifact creatures and Heroes you control get +1/+1 for
//    each Artificer...") needs an OR of two different subtype groups
//    (Artifact creatures + Heroes) with a dynamically-computed amount —
//    `pumpAll`'s own `predicate`/`subtype` only support ONE subtype filter
//    over 'creatures-you-control', no OR of two groups.
//  - "A deck can have any number of cards named CARDNAME" is a deck-
//    construction rule, not a resolvable/continuous game effect.
// Both stay static text. Cycling {W}{U} (ENGINE_GAPS.md gap #23, closed
// 2026-09-14) is now a real, structured, engine-piloted activated ability
// (`abilities`) — a genuine 602.1 activation FROM HAND, cost = {W}{U} +
// discard this card itself (`engine.ts`'s `costRequiresDiscardSelf`),
// resolving to a plain `drawCard`. See cloudbound-moogle/definition.ts's
// own comment for the full mechanism.
export const cidTimelessArtificer: CardDefinition = {
  name: 'Cid, Timeless Artificer',
  manaCost: '{2}{W}{U}',
  typeLine: 'Legendary Creature — Human Artificer',

  pt: [4, 4],

  staticAbilities: [
    'Artifact creatures and Heroes you control get +1/+1 for each Artificer you control and each Artificer card in your graveyard.',
    'A deck can have any number of cards named Cid, Timeless Artificer.',
  ],

  abilities: [{ name: 'cycling', cost: '{W}{U}, Discard this card', effects: [{ kind: 'drawCard' } satisfies Effect] }],
};
