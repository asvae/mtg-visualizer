import type { CardDefinition, Effect } from '../../card';

export const edgarKingOfFigaro: CardDefinition = {
  name: 'Edgar, King of Figaro',
  manaCost: '{4}{U}{U}',
  typeLine: 'Legendary Creature — Human Artificer Noble',

  pt: [4, 5],

  // 'TwoHeadedCoin' (ENGINE_GAPS.md gap #15, closed) — a real, structured
  // keyword replacing the old freeform `staticAbilities` text for "Two-
  // Headed Coin — The first time you flip one or more coins each turn,
  // those coins come up heads and you win those flips." Real Forge
  // citation, `res/cardsfolder/e/edgar_king_of_figaro.txt`'s own shipped
  // script: `S:Mode$ FlipCoinMod | ValidPlayer$ You | CheckSVar$
  // Count$YouFlipThisTurn | SVarCompare$ EQ0 | Result$ True` — checked at
  // `state.flipCoin`'s own one real chokepoint (see that method's own doc
  // comment for the full citation/scoping). Approximated via the SAME
  // keyword-grant machinery `card.ts`'s own `Keyword` doc comment already
  // establishes for `'Unblockable'` — not a name-matched freeform string
  // anymore.
  keywords: ['TwoHeadedCoin'],

  triggers: [
    {
      name: 'onEnter',
      // Real 603.6b auto-fire (matching Weapons Vendor's/Cloud, Midgar
      // Mercenary's own convention) — needed so an engine-piloted
      // `pilotResolveTop` fires this for real rather than requiring a
      // scenario to name it explicitly.
      on: 'enter',
      effects: [
        {
          kind: 'drawCard',
          // Real `NumCards$ Count$Valid Artifact.YouCtrl` — a live count
          // read at resolution, the `Computed<number>` escape hatch's own
          // canonical use (a real cross-state read, not a fixed value).
          amount: (ctx) => ctx.you.getCardsIn('Battlefield').filter((c) => c.isArtifact()).length,
        } satisfies Effect,
      ],
    },
  ],
};
