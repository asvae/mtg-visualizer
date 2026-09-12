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
  // MillPlus4 | ...` + `SVar:MillPlus4:DB$ ReplaceEffect | VarName$ Number
  // | VarValue$ X` + `SVar:X:ReplaceCount$Number/Plus.4`). Real, mechanical
  // engine vocabulary now exists for this (ENGINE_GAPS.md gap #19, closed):
  // `card.ts`'s `millModifierGrants`/`MillModifierGrant` — copied onto the
  // resolved permanent at `resolveTop`, consumed by `state.ts`'s
  // `activeMillModifier`, checked inside the new `GameState.mill` real
  // chokepoint every mill effect in this pool now funnels through (instead
  // of the generic `move` Effect kind, which has no way to intercept "this
  // specific move is a mill").
  millModifierGrants: [{ amount: 4 }],

  // "{4}{U}{U}, {T}: Each opponent mills cards equal to the number of
  // cards in your hand." Real Forge `A:AB$ Mill | Cost$ 4 U U T |
  // Defined$ Opponent | NumCards$ Y | SVar:Y:Count$ValidHand
  // Card.YouOwn` — a live read of your own hand size at resolution
  // (`Computed<number>`). Modeled as a real `kind: 'mill'` Effect (ENGINE_
  // GAPS.md gap #19, closed) — routes through `state.mill` (via
  // `Actions.mill`), the one real chokepoint the `millModifierGrants`
  // clause above can now genuinely hook into: when this permanent is
  // resolved for real (engine-piloted), the ability's own mill amount is
  // mechanically bumped by +4, not just described in text.
  activationCost: '{4}{U}{U}, {T}',
  effects: [
    {
      kind: 'mill',
      owner: 'opponents',
      amount: (ctx) => ctx.you.getCardsIn('Hand').length,
    } satisfies Effect,
  ],
};
