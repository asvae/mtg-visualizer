import type { CardDefinition, Effect } from '../../card';

export const prisheSWanderings: CardDefinition = {
  name: "Prishe's Wanderings",
  manaCost: '{2}{G}',
  typeLine: 'Instant',

  effects: [
    // "Search your library for a basic land card or Town card" — a search
    // (601.2c: no stack targeting), so `target` stays omitted, same
    // convention call-the-mountain-chocobo/opera-love-song already use for
    // an unchosen library search. `move`'s own declarative `validType` has
    // no basic-OR-Town disjunctive filter (only `'creature'|'artifact'|
    // 'land'|'any'`), so `'land'` is the closest fit — real "Town" cards
    // are themselves Land-typed in this set, so this only loses the
    // basic-vs-nonbasic distinction, not the land/nonland one. `move` also
    // has no `tapped` field (only `createToken` does), so "put it onto the
    // battlefield TAPPED" is lost — same class of documentary loss as
    // "then shuffle" elsewhere in this codebase. NOTE: no `PlayerState`
    // field seeds a land-typed library filler card (harness.ts's own
    // `setupPlayer` only offers plain/artifact library fillers), so this
    // half is real, correct code no scenario below can actually exercise —
    // same real gap call-the-mountain-chocobo's own Mountain search
    // already flags.
    { kind: 'move', owner: 'you', from: 'Library', to: 'Battlefield', qty: 1, validType: 'land' } satisfies Effect,
    // "When you search your library this way, put a +1/+1 counter on
    // target creature you control" — real `ValidTgts$ Creature.YouCtrl`
    // genuinely restricts the target, so `owner: 'you'` is set here.
    // This model has no conditional effect-chaining (no way to gate this
    // second effect on the search above actually having found a land), so
    // it always resolves — a known simplification shared with every other
    // multi-effect card in this codebase that doesn't model branch
    // conditions.
    { kind: 'putCounterTarget', validType: 'creature', counterType: '+1/+1', amount: 1, owner: 'you' } satisfies Effect,
  ],
};
