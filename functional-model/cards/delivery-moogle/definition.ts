import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const deliveryMoogle: CardDefinition = {
  name: 'Delivery Moogle',
  manaCost: '{3}{W}',
  typeLine: 'Creature — Moogle',

  keywords: ['Flying'],

  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
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
          // 2026-09-11 correction: an earlier version of this comment
          // claimed mana value couldn't be filtered here at all ("not
          // tracked anywhere on Card/RealCard") — checked again against
          // interfaces.ts/state.ts/harness.ts while migrating this card's
          // synergy facts and that claim was simply WRONG, not a real
          // engine gap: `Card.getCMC()` is a real, cited interface method
          // (interfaces.ts ~line 106, Card.java ~line 7227), backed by a
          // real `RealCard.getCMC` (state.ts) and already wired into
          // `harness.ts`'s own `loggingCard` wrap (`read:getCMC` trace
          // evidence) — the exact same "real primitive already exists
          // elsewhere in this model" situation `isArtifact` was already in
          // above. The stale claim's own citation ("same real gap
          // cloud-midgar-mercenary's own comment already flags") also
          // doesn't exist — grepped that file, it has no mana-value
          // filter or comment about one at all (Cloud's own search has no
          // mv restriction to begin with). Fixed for real below rather
          // than left as a documented-but-false gap. "Shuffle" has no
          // library-reorder consequence anything downstream reads, so it's
          // not modeled (state.ts's own header rules out anything beyond
          // the action vocabulary card.ts/harness.ts actually use).
          //
          // The graveyard branch is independently exercised by its own
          // scenario (2026-09-11) via `harness.ts`'s new
          // `PlayerState.graveyardArtifactCount` (mirrors the pre-existing
          // `libraryArtifactCount`) — this was a real, fixable harness gap
          // (a missing setup field), not a permanent engine limitation.
          // Neither seeded filler artifact (library or graveyard) is given
          // an explicit `cmc` (defaults to `RealCard.cmc ?? 0`, i.e. 0),
          // so no scenario here currently proves the mv-2-or-less filter
          // actually EXCLUDES a real >2-mv candidate — both real scenarios
          // only demonstrate it correctly ADMITTING a 0-mv one. A future
          // scenario wanting that negative case would need a
          // `libraryArtifactCmc`/`graveyardArtifactCmc`-style harness field
          // this task didn't need to add.
          kind: 'custom',
          describe: 'search your library and/or graveyard for an artifact card with mana value 2 or less and put it into your hand',
          run: (ctx: EffectContext, actions: Actions) => {
            const pool = [...ctx.you.getCardsIn('Library'), ...ctx.you.getCardsIn('Graveyard')].filter((c) => c.isArtifact() && c.getCMC() <= 2);
            if (pool.length === 0) return;
            const target = actions.chooseTarget(pool);
            actions.moveTo(target, 'Hand');
          },
        } satisfies Effect,
      ],
    },
  ],
};
