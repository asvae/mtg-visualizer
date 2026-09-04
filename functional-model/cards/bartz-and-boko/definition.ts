import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const bartzAndBoko: CardDefinition = {
  name: 'Bartz and Boko',
  manaCost: '{3}{G}{G}',
  typeLine: 'Legendary Creature — Human Bird',

  pt: [4, 3],

  // Real K:Affinity:Bird — a genuine dynamic mana-cost reduction (costs {1}
  // less per Bird you control). No cost-reduction machinery exists anywhere
  // in this model (`manaCost` is a fixed printed string) — same treatment
  // travel-the-overworld's own Affinity for Towns already gets: real text,
  // not an executed effect.
  staticAbilities: ['Affinity for Birds (This spell costs {1} less to cast for each Bird you control.)'],

  triggers: [
    {
      name: 'onEnter',
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
