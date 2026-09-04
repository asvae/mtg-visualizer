import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const selfDestruct: CardDefinition = {
  name: 'Self-Destruct',
  manaCost: '{1}{R}',
  typeLine: 'Instant',

  effects: [
    {
      // "Target creature you control deals X damage to any other target and
      // X damage to itself, where X is its power" — same "a later effect
      // needs a chosen target's own live power" shape as nibelheim-aflame's
      // own custom effect. "Any other target" (could be a player) is
      // narrowed to "any other creature" — `chooseTarget` (the only
      // targeting primitive here) only ever picks from a `Card[]` pool, the
      // same scope `dealDamageTarget`'s own declarative Effect kind already
      // has (see card.ts's own doc comment on it).
      kind: 'custom',
      describe: 'target creature you control deals X damage to any other target and X damage to itself, where X is its power',
      run: (ctx: EffectContext, actions: Actions) => {
        const sourcePool = ctx.you.getCreaturesInPlay();
        if (sourcePool.length === 0) return;
        const source = actions.chooseTarget(sourcePool);
        const x = source.getNetPower();
        const otherCreatures = [...ctx.you.getCreaturesInPlay(), ...ctx.opponents.flatMap((p) => p.getCreaturesInPlay())].filter((c) => c.getId() !== source.getId());
        if (otherCreatures.length > 0) {
          const other = actions.chooseTarget(otherCreatures);
          actions.dealDamage(source, other, x);
        }
        actions.dealDamage(source, source, x);
      },
    } satisfies Effect,
  ],
};
