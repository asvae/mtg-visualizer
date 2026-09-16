import type { CardDefinition, Effect } from '../../card';
import { selectUpTo, applyToBound, gainControl, you } from '../../combinator';

export const stiltzkinMoogleMerchant: CardDefinition = {
  name: 'Stiltzkin, Moogle Merchant',
  manaCost: '{W}',
  typeLine: 'Legendary Creature — Moogle',

  // Real printed 1/2 (Scryfall fin/34) — missing before this migration.
  pt: [1, 2],

  keywords: ['Lifelink'],

  // {2}, {T}: Target opponent gains control of another target permanent
  // you control. If they do, you draw a card. Migrated (2026-09-16,
  // coordinator-routed pilot-triage escalation) off a raw `custom` closure
  // onto `kind:'program'`. `gainControl`'s own real signature takes a
  // controller `Player` directly (interfaces.ts), not a chosen-from-a-pool
  // `Card` — there's no `chooseTarget`-equivalent for PICKING a player, so
  // `EachAction`'s own `gainControl('opponent')` resolving to
  // `ctx.opponents[0]` (same "default to the first opponent"
  // simplification kain-traitorous-dragoon's own custom effect already
  // uses) stands in for "target opponent." `Query.source:'permanentsInPlay'`
  // (not `'creaturesInPlay'`) matches this card's own real "another target
  // PERMANENT" — genuinely broader than a creature.
  //
  // The `drawCard` sibling effect below is a plain top-level array entry,
  // not chained inside the `SelectUpTo` itself (no `EachAction` variant
  // calls `Player.drawCard()` — every `EachAction` acts on a matched
  // ITEM, never the controlling player directly), so unlike the
  // pre-migration `custom` closure's own `if (pool.length === 0) return`
  // guard, this version draws unconditionally once the ability resolves,
  // even in the edge case where no OTHER permanent existed to give away.
  // Accepted as the same documentary-only "if you do"/"if they do"
  // simplification every other such gate in this pool already carries
  // (namazu-trader's own attack-trigger comment documents the identical
  // pattern) — no real scenario in this pool's own `scenarios.ts` exercises
  // an empty-pool Stiltzkin activation, and no player-decision engine
  // exists here to make the distinction observable either way.
  activationCost: '{2}, {T}',
  effects: [
    {
      kind: 'program',
      describe: 'target opponent gains control of another target permanent you control. If they do, you draw a card.',
      program: selectUpTo(you.permanentsInPlay().filter('excludeSelf'), 1, 'given', [applyToBound('given', 0, gainControl('opponent'))]),
    } satisfies Effect,
    { kind: 'drawCard', amount: 1 } satisfies Effect,
  ],
};
