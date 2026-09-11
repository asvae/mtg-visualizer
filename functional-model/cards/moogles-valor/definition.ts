import type { CardDefinition, Effect, EffectContext } from '../../card';
import { TOKENS } from '../../tokens.ts';

export const mooglesValor: CardDefinition = {
  name: "Moogles' Valor",
  manaCost: '{3}{W}{W}',
  typeLine: 'Instant',

  // "For each creature you control, create a 1/2 white Moogle creature
  // token with lifelink. Then creatures you control gain indestructible
  // until end of turn." Both real gaps this used to need `custom` for are
  // now closed: `TOKENS.w_1_2_moogle_lifelink` (this pass) gives the made
  // token a real, structurally-tracked `keywords: ['Lifelink']` (TokenInfo
  // DOES carry a `keywords` field, and `state.createToken` DOES copy it
  // onto the made RealCard — an earlier version of this file's own comment
  // claimed neither existed; both are real and already wired, just not
  // previously checked against), and `grantKeywordAll` (added since,
  // Ardyn/Circle of Power precedent) gives the board-wide "creatures you
  // control gain indestructible" a real, mechanically-enforced grant.
  effects: [
    {
      kind: 'createToken',
      token: TOKENS.w_1_2_moogle_lifelink,
      amount: (ctx: EffectContext) => ctx.you.getCreaturesInPlay().length,
    } satisfies Effect,
    // Runs AFTER the tokens above are actually created (real state.ts
    // mutation, not a snapshot) — `getCreaturesInPlay()` inside
    // `grantKeywordAll` sees the just-made Moogle tokens too, matching the
    // real card's own "then" sequencing (same ordering the-crystal-s-
    // chosen's own "then put a +1/+1 counter on each creature you control"
    // comment documents).
    { kind: 'grantKeywordAll', predicate: 'creatures-you-control', keyword: 'Indestructible' } satisfies Effect,
  ],
};
