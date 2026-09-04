import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const mooglesValor: CardDefinition = {
  name: "Moogles' Valor",
  manaCost: '{3}{W}{W}',
  typeLine: 'Instant',

  // "For each creature you control, create a 1/2 white Moogle creature
  // token with lifelink. Then creatures you control gain indestructible
  // until end of turn." Two real gaps, both `custom`:
  //  - `createToken`'s own `TokenInfo` (interfaces.ts) has no `keywords`
  //    field at all, and `state.createToken` doesn't copy any onto the
  //    made `RealCard` even if it did — a made token's own Lifelink is
  //    real printed text (kept in this effect's `describe`) but isn't a
  //    structured, checkable fact on the token object today.
  //  - `pumpAll` (the real Effect kind this SAME ability's own
  //    `DB$ PumpAll | KW$ Indestructible` SVar would otherwise map to) only
  //    carries `power`/`toughness` deltas — no keyword-grant field, so a
  //    board-wide temporary-keyword grant has no declarative shape to use.
  // Both flagged to the parent session as a real, recurring gap (this
  // batch also hits it on Restoration Magic) — `createToken` is still used
  // for the real token-count/token-object part of this effect, since that
  // part IS fully declarative.
  effects: [
    {
      kind: 'custom',
      describe:
        'for each creature you control, create a 1/2 white Moogle creature token with lifelink (token Lifelink not structurally tracked — see this file\'s own comment); then creatures you control gain indestructible until end of turn (no keyword-grant Effect shape exists yet — not mechanically enforced)',
      run: (ctx: EffectContext, actions: Actions) => {
        const amount = ctx.you.getCreaturesInPlay().length;
        if (amount > 0) {
          actions.createToken(ctx.you, { name: 'Moogle', manaCost: '0', types: ['Creature', 'Moogle'], basePower: 1, baseToughness: 2 }, amount);
        }
        // "creatures you control gain indestructible until end of turn" —
        // no-op beyond the token creation above: no keyword-grant action
        // exists (`pump` only ever moves P/T, never keywords). Real text
        // only, via `describe` above, same honest treatment
        // crystal-fragments-summon-alexander's own damage-prevention
        // chapters get for a mechanic this model has no machinery for.
      },
    } satisfies Effect,
  ],
};
