import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

// Real script (eden_seat_of_the_sanctum.txt): no `R:Event$ Moved ...
// ReplaceWith$ ETBTapped` line — Eden genuinely enters UNTAPPED (unlike
// most of this batch).
//
// "{5}, {T}: Mill two cards. Then you may sacrifice this land. When you
// do, return another target permanent card from your graveyard to your
// hand." is ONE ability chain (real `SubAbility$` links, not independent
// abilities):
//  - "Mill two cards" is a real, unchosen library->graveyard batch move —
//    exactly `move`'s own declarative shape (`from: 'Library', to:
//    'Graveyard'`), no `mill` Effect kind needed even though `mill` is
//    declared (unwired) in interfaces.ts.
//  - "You may sacrifice THIS land. When you do, return another target
//    permanent card from your graveyard to your hand" doesn't fit
//    `sacrifice`'s declarative shape: `sacrifice`'s `validType` has no
//    'land' option, and there is no "self only" mode (`notSelf` only ever
//    EXCLUDES self from a pool, it can't restrict TO self) — so a pool-
//    based `sacrifice` call could grab some other land you control instead
//    of this one specifically. Real primitives exist for the exact real
//    behavior though (`actions.moveTo(self, 'Graveyard')` IS what
//    sacrificing this land does; `actions.chooseTarget` + `actions.moveTo`
//    for the follow-up return), so this is a precise `custom`
//    implementation (same class of composite as elixir's own precedent),
//    not an invented mechanic. The "may"/optional decision isn't modeled
//    (no player-decision engine exists anywhere here — same documentary-
//    only convention every other `optional` field already carries), so
//    the sacrifice always happens once this ability resolves.
export const edenSeatOfTheSanctum: CardDefinition = {
  name: 'Eden, Seat of the Sanctum',
  manaCost: '',
  typeLine: 'Land — Town',

  // {T}: Add {C} — real mana ability, no mana-producing Effect/Action
  // exists anywhere in this model, the documented STILL-DEFERRED gap.
  staticAbilities: ['{T}: Add {C}.'],

  activationCost: '{5}, {T}',
  effects: [
    { kind: 'move', owner: 'you', from: 'Library', to: 'Graveyard', qty: 2 } satisfies Effect,
    {
      kind: 'custom',
      describe: 'sacrifice this land; when you do, return another target permanent card from your graveyard to your hand',
      run: (ctx: EffectContext, actions: Actions) => {
        actions.moveTo(ctx.self, 'Graveyard');
        const pool = ctx.you.getCardsIn('Graveyard').filter((c) => c.getId() !== ctx.self.getId());
        if (pool.length > 0) actions.moveTo(actions.chooseTarget(pool), 'Hand');
      },
    } satisfies Effect,
  ],
};
