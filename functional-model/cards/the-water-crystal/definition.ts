import type { CardDefinition, Effect } from '../../card';

export const theWaterCrystal: CardDefinition = {
  name: 'The Water Crystal',
  manaCost: '{2}{U}{U}',
  typeLine: 'Legendary Artifact',

  // "Blue spells you cast cost {1} less to cast." — real (2026-09-12,
  // ENGINE_GAPS.md gap #7's second example, the exact same mechanism The
  // Wind Crystal's own White-spell discount uses): a real, unconditional,
  // color-gated BROADCAST cost reduction onto OTHER spells this
  // permanent's controller casts — `card.ts`'s `SpellCostReductionGrant`
  // (real Forge citation, `res/cardsfolder/t/the_water_crystal.txt`:
  // `S:Mode$ ReduceCost | ValidCard$ Card.Blue | Type$ Spell | Activator$
  // You | Amount$ 1 | ...`). `engine.ts`'s `canCastSpell`/`castSpell` sum
  // every matching grant on the CASTER's own battlefield (`state.ts`'s
  // `activeSpellCostDiscount`) against the cast spell's own colored
  // mana-cost pips.
  spellCostReductionGrants: [{ amount: 1, colors: ['U'] }],

  // "If an opponent would mill one or more cards, they mill that many
  // cards plus four instead." — a genuine CR 614.2 replacement effect on
  // the MILL event (real Forge citation, same file: `R:Event$ Mill |
  // ActiveZones$ Battlefield | ValidPlayer$ Player.Opponent | ReplaceWith$
  // MillPlus4 | ...`). UNMODELED — new engine gap, ENGINE_GAPS.md #19.
  // Unlike gap #8b's lifegain-doubling (closed via a real, pre-existing
  // `state.gainLife` chokepoint every lifegain call already funneled
  // through), this engine has NO chokepoint to hook at all for mill: there
  // is no `state.mill()` method anywhere in `state.ts` — `interfaces.ts`'s
  // own `mill()` is a pure ambient Forge-signature mirror, never given a
  // real body, same undone-mirror status as `scry`/`surveil`. Milling is
  // only ever modeled ad hoc via the generic `move` Effect kind (library
  // -> graveyard, an unchosen batch — see this card's own activated
  // ability below), which every OTHER zone-change effect in the pool
  // (bounce, sacrifice, exile, tutor, ...) also funnels through — there is
  // no way to intercept "this specific move is a mill" without first
  // building a real, dedicated mill action/chokepoint (analogous to what
  // `gainLife` already was before gap #8b's replacement hooked into it).
  // Real text only, not mechanically enforced.
  staticAbilities: [
    'If an opponent would mill one or more cards, they mill that many cards plus four instead.',
  ],

  // "{4}{U}{U}, {T}: Each opponent mills cards equal to the number of
  // cards in your hand." Real Forge `A:AB$ Mill | Cost$ 4 U U T |
  // Defined$ Opponent | NumCards$ Y | SVar:Y:Count$ValidHand
  // Card.YouOwn` — a live read of your own hand size at resolution
  // (`Computed<number>`). The BASE mill amount IS mechanically real,
  // modeled as `move` (library -> graveyard, an unchosen batch — Forge
  // itself dispatches this through a dedicated MillEffect this model
  // doesn't mirror; see card.ts's own `move` doc comment for the same
  // "unchosen batch" shape Malboro's own exile-top-three uses). The +4
  // replacement above is NOT applied by this effect (see gap #19 above) —
  // this only ever mills the printed, undoubled amount.
  activationCost: '{4}{U}{U}, {T}',
  effects: [
    {
      kind: 'move',
      owner: 'opponents',
      from: 'Library',
      to: 'Graveyard',
      qty: (ctx) => ctx.you.getCardsIn('Hand').length,
    } satisfies Effect,
  ],
};
