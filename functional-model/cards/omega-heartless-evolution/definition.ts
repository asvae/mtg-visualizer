import type { CardDefinition, Effect, EffectContext } from '../../card';

export const omegaHeartlessEvolution: CardDefinition = {
  name: 'Omega, Heartless Evolution',
  manaCost: '{5}{G}{U}',
  typeLine: 'Legendary Artifact Creature — Robot',

  pt: [8, 8],

  triggers: [
    {
      // "For each opponent, tap up to one target nonland permanent that
      // opponent controls. Put X stun counters on each of those permanents
      // and you gain X life, where X is the number of nonbasic lands you
      // control." Two approximations, both real gaps rather than invented
      // shortcuts: (1) `tapTarget`/`putCounterTarget`'s own `validType`
      // union has no "nonland permanent" filter (only 'creature'/
      // 'artifact'/'land'/'creature-or-artifact'/'any') — 'creature-or-
      // artifact' is the closest real fit, losing only the enchantment
      // case. (2) nothing in `RealCard`/`PlayerState` distinguishes basic
      // from nonbasic lands — X is approximated as the controller's TOTAL
      // land count via `getLandsInPlay()`. "For each opponent" (a real
      // per-opponent loop) collapses to this model's usual single
      // `tapTarget` pick across the combined opponent pool, same as every
      // other targeted effect here.
      name: 'onEnter',
      effects: [
        { kind: 'tapTarget', validType: 'creature-or-artifact', owner: 'opponents' } satisfies Effect,
        {
          kind: 'putCounterTarget',
          validType: 'creature-or-artifact',
          counterType: 'Stun',
          owner: 'opponents',
          amount: (ctx: EffectContext) => ctx.you.getLandsInPlay().length,
        } satisfies Effect,
        { kind: 'gainLife', amount: (ctx: EffectContext) => ctx.you.getLandsInPlay().length } satisfies Effect,
      ],
    },
  ],
};
