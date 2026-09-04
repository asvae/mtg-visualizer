import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const deliveryMoogle: CardDefinition = {
  name: 'Delivery Moogle',
  manaCost: '{3}{W}',
  typeLine: 'Creature — Moogle',

  keywords: ['Flying'],

  triggers: [
    {
      name: 'onEnter',
      effects: [
        {
          // "Search your library and/or graveyard for an artifact card with
          // mana value 2 or less" — a genuine two-zone search (real Forge
          // Origin$ Library | OriginAlternative$ Graveyard), which the
          // declarative `move` kind can't express (`from` is exactly one
          // zone). Modeled fully via `custom` instead of narrowing to
          // Library-only, since both zone reads are already real
          // primitives (`getCardsIn`) this model has everywhere else.
          //
          // Mana value isn't tracked anywhere on Card/RealCard at all
          // (confirmed against interfaces.ts/state.ts — no getManaValue
          // anywhere), so "mana value 2 or less" can't be filtered here;
          // same real gap cloud-midgar-mercenary's own comment already
          // flags for its own artifact search. "Shuffle" has no library-
          // reorder consequence anything downstream reads, so it's not
          // modeled (state.ts's own header rules out anything beyond the
          // action vocabulary card.ts/harness.ts actually use).
          //
          // NOTE: harness.ts's own `PlayerState` (Scenario setup) has no
          // field to seed an artifact card actually sitting in a player's
          // graveyard (only `graveyardCreatureCount` exists) — so the
          // graveyard branch of this effect is real, executable code but
          // can't be independently exercised by a scenario. Flagged to the
          // parent session separately rather than silently left untested.
          kind: 'custom',
          describe: 'search your library and/or graveyard for an artifact card with mana value 2 or less and put it into your hand',
          run: (ctx: EffectContext, actions: Actions) => {
            const pool = [...ctx.you.getCardsIn('Library'), ...ctx.you.getCardsIn('Graveyard')].filter((c) => c.isArtifact());
            if (pool.length === 0) return;
            const target = actions.chooseTarget(pool);
            actions.moveTo(target, 'Hand');
          },
        } satisfies Effect,
      ],
    },
  ],
};
