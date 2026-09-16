import type { CardDefinition, Effect } from '../../card';
import { drawCard, you } from '../../combinator';

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
          // Real `NumCards$ Count$Valid Artifact.YouCtrl` — a live count
          // read at resolution. Migrated 2026-09-16 (AI-fact-elimination
          // pass) off a `kind:'drawCard'` `Computed<number>` closure (opaque
          // to every recognizer by construction) onto the combinator DSL:
          // `you.permanentsInPlay().filter('cardType','artifact').count()`
          // is the exact same live board-state read
          // (`ctx.you.getCardsIn('Battlefield').filter(c => c.isArtifact())
          // .length`), now real structured data instead of a closure. Same
          // behavior confirmed unchanged via `run-scenarios.mjs` (still
          // draws 2 cards for 2 real artifacts on the battlefield).
          // Does NOT yet flip this fact's provenance on its own —
          // `drawCardProgram-effect-structural.ts` only has a confirmed
          // template for `amount === 1` behind a subtype guard (Venat's own
          // shape) today, not an `Aggregate`-based count; still a real
          // recognizer-lane escalation (see this card's own progress.json).
          kind: 'program',
          describe: 'draw a card for each artifact you control',
          program: drawCard(you.permanentsInPlay().filter('cardType', 'artifact').count()),
        } satisfies Effect,
      ],
    },
  ],
};
