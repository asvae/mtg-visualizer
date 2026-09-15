import type { CardDefinition, Effect } from '../../card';
import { flashback } from '../../flashback';

export const auronSInspiration: CardDefinition = {
  name: "Auron's Inspiration",
  manaCost: '{2}{W}',
  typeLine: 'Instant',

  alternateCosts: [flashback('{2}{W}{W}')],

  // Own annotation: `definition-annotations.json`, keyed `"effects"`.
  effects: [
    {
      // "Attacking creatures get +2/+0 until end of turn" — REAL as of
      // 2026-09-15 (ENGINE_GAPS.md closure), no longer a documented no-op.
      // This effect used to be an honest `kind:'custom'` no-op specifically
      // because closing it needed 3 real, cross-cutting engine additions
      // this single card's own migration couldn't justify alone — all 3
      // landed this pass:
      //   1. `Card.isAttacking()` (interfaces.ts) — real CR 506.4/508.1
      //      status, backed by a new `GameState.attackers` (state.ts,
      //      dual-written from `engine.ts`'s own pre-existing
      //      `GameEngine.attackers` at `declareAttackers` — see both
      //      fields' own doc comments).
      //   2. `pumpAll`'s own `predicate` union gained `'attacking-
      //      creatures'` (card.ts) — the one real SYMMETRIC predicate
      //      (`ctx.you` AND `ctx.opponents` both, unlike every other
      //      `pumpAll` predicate's `ctx.you`-only scope), matching this
      //      card's own real text (no "you control" qualifier at all).
      //   3. `recognizers/pumpAllAttacking-effect-structural.ts` — a new
      //      structural recognizer reading THIS exact shape, closing this
      //      card's own last remaining hand-authored fact for real.
      // (Flashback, this card's OTHER real ability, was already fully real
      // — see `alternateCosts` above and `engine.ts`'s own
      // `canCastSpell`/`castSpell`'s `alt` param, ENGINE_GAPS.md gap #7.)
      kind: 'pumpAll',
      predicate: 'attacking-creatures',
      power: 2,
      toughness: 0,
      untilEndOfTurn: true,
    } satisfies Effect,
  ],
};
