import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const callTheMountainChocobo: CardDefinition = {
  name: 'Call the Mountain Chocobo',
  manaCost: '{3}{R}',
  typeLine: 'Sorcery',

  alternateCosts: [{ name: 'Flashback', cost: '{5}{R}', from: 'graveyard', thenExile: true }],

  effects: [
    {
      // `move`'s own declarative `validType` is type-only
      // (creature/artifact/any) — no land/subtype filter exists to express
      // "search your library for a Mountain card" (same gap magitek-
      // infantry's own name-search and delivery-moogle's own mana-value
      // filter already document for `move`), so this is `custom`,
      // filtering the real library by `isLand()` + `hasSubtype('Mountain')`
      // (both real, already-exposed Card predicates). NOTE: no
      // `PlayerState` field exists to seed a land-typed (let alone
      // Mountain-subtyped) card into a scenario's library — every generic
      // library filler `harness.ts`'s `setupPlayer` makes has `types: []`
      // — so this half of the effect is real, correct code that no
      // scenario below can actually exercise. Flagged to the parent
      // session as a real gap, same "real code, untestable" situation
      // delivery-moogle's own graveyard-search branch already hit.
      // "Then shuffle" has no observable consequence in this model.
      kind: 'custom',
      describe: 'search your library for a Mountain card, reveal it, put it into your hand, then shuffle',
      run: (ctx: EffectContext, actions: Actions) => {
        const pool = ctx.you.getCardsIn('Library').filter((c) => c.isLand() && c.hasSubtype('Mountain'));
        if (pool.length === 0) return;
        const found = actions.chooseTarget(pool);
        actions.moveTo(found, 'Hand');
      },
    } satisfies Effect,
    // Real TokenScript$ g_2_2_bird_landfall — not in tokens.ts, added
    // inline (same convention circle-of-power/cornered-by-black-mages use
    // for a token their own card needs that isn't in the shared registry).
    // The token's own granted landfall pump ability has no representable
    // field on `TokenInfo` (name/manaCost/types/basePower/baseToughness
    // only) — real printed text, lost the same way every other token's
    // own granted keyword/ability is lost here (see moogles-valor's own
    // comment on this exact TokenInfo limitation).
    { kind: 'createToken', token: { name: 'Bird', manaCost: '0', types: ['Creature', 'Bird'], basePower: 2, baseToughness: 2 }, amount: 1 } satisfies Effect,
  ],
};
