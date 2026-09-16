import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const bartzAndBoko: CardDefinition = {
  name: 'Bartz and Boko',
  manaCost: '{3}{G}{G}',
  typeLine: 'Legendary Creature — Human Bird',

  pt: [4, 3],

  // Real K:Affinity:Bird — now real, executable `costReduction.perControlled`
  // (2026-09-16, static-ability audit follow-up), the same board-state-
  // counted mechanism travel-the-overworld's own Affinity for Towns already
  // uses (ENGINE_GAPS.md gap #7).
  staticAbilities: ['Affinity for Birds (This spell costs {1} less to cast for each Bird you control.)'],
  costReduction: { perControlled: { amountPerMatch: 1, subtype: 'Bird' } },

  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
      effects: [
        {
          // "Each other Bird you control deals damage equal to its power to
          // target creature an opponent controls" — a real Forge
          // `EachDamage` (multiple, distinct sources each dealing their own
          // live power to ONE chosen target), not a single `dealDamageTarget`
          // call. No declarative Effect kind models "every matching creature
          // deals ITS OWN power as damage to one shared target" — `custom`,
          // choosing the target once then looping every other Bird you
          // control, is the honest shape (same "read each source's own live
          // power" pattern nibelheim-aflame's own custom effect already
          // uses, just with multiple sources instead of one).
          kind: 'custom',
          describe: 'each other Bird you control deals damage equal to its power to target creature an opponent controls',
          run: (ctx: EffectContext, actions: Actions) => {
            const targetPool = ctx.opponents.flatMap((p) => p.getCreaturesInPlay());
            if (targetPool.length === 0) return;
            const target = actions.chooseTarget(targetPool);
            const otherBirds = ctx.you.getCreaturesInPlay().filter((c) => c.hasSubtype('Bird') && c.getId() !== ctx.self.getId());
            for (const bird of otherBirds) actions.dealDamage(bird, target, bird.getNetPower());
          },
        } satisfies Effect,
      ],
    },
  ],
};
