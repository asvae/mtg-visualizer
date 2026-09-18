import type { CardDefinition, Effect } from '../../card';
import { you } from '../../combinator';

// `amount` used to be a raw `(ctx: EffectContext) => number` closure — real,
// legitimate vocabulary this codebase already uses elsewhere for board-state
// magnitudes (`rufus-shinra`/`serah-farron-crystallized-serah`/
// `bartz-and-boko`, e.g.), but opaque to the sink-model's STRUCTURAL matcher
// (`sink-model/match-sink.ts`'s `matchesBattlefieldPresenceConsumer` can only
// read declarative fields, never look inside an arbitrary function). Migrated
// (2026-09-18) onto `combinator.ts`'s own board-count primitive — a
// `QueryChain.count()` `Aggregate`, now a valid `createToken.amount` `ValueRef`
// (see `card.ts`'s own `resolveCreateTokenAmount`) — via the new
// `'sameNameAsSelf'` `FilterPredicate` (`combinator.ts`'s own doc comment):
// "creatures you control sharing my own name, other than me." Same real
// resolved value as the old closure, now real, walkable data instead of code
// — see `sink-model/catalog/battlefield-presence-hare-apparent.ts`'s own
// header for the sink-catalog entry this unblocks.
export const hareApparent: CardDefinition = {
  name: 'Hare Apparent',
  manaCost: '{1}{W}',
  typeLine: 'Creature — Rabbit Noble',
  pt: [2, 2],

  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
      effects: [
        {
          kind: 'createToken',
          token: {
            name: 'Rabbit',
            manaCost: '0',
            types: ['Creature', 'Rabbit'],
            basePower: 1,
            baseToughness: 1,
          },
          amount: you.creaturesInPlay().filter('sameNameAsSelf').count(),
        } satisfies Effect,
      ],
    },
  ],
};
