import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const jenovaAncientCalamity: CardDefinition = {
  name: 'Jenova, Ancient Calamity',
  manaCost: '{2}{B}{G}',
  typeLine: 'Legendary Creature — Alien',

  pt: [1, 5],

  triggers: [
    {
      // "Put a number of +1/+1 counters equal to Jenova's power on up to
      // one OTHER target creature [any player's — real ValidTgts$
      // Creature.Other, no controller clause]. That creature becomes a
      // Mutant in addition to its other types." The counters and the
      // type-grant must land on the SAME chosen creature, but `animate`
      // (this model's only type-grant Effect) is hardcoded to `target:
      // 'self'` — it has no target-a-chosen-creature shape at all, unlike
      // `pumpTarget`/`putCounterTarget`/`grantKeywordTarget`. `custom` is
      // the honest fit here (both real Forge actions, just not reachable
      // as two independent declarative effects on the same target).
      name: 'onBeginCombat',
      effects: [
        {
          kind: 'custom',
          describe: "put a number of +1/+1 counters equal to Jenova's power on up to one other target creature; that creature becomes a Mutant in addition to its other types",
          run: (ctx: EffectContext, actions: Actions) => {
            const pool = [ctx.you, ...ctx.opponents].flatMap((p) => p.getCreaturesInPlay()).filter((c) => c.getId() !== ctx.self.getId());
            if (pool.length === 0) return;
            const target = actions.chooseTarget(pool);
            actions.putCounter(target, '+1/+1', ctx.self.getNetPower());
            actions.animate(target, ['Mutant']);
          },
        } satisfies Effect,
      ],
    },
    {
      // "Whenever a Mutant you control dies during your turn, you draw
      // cards equal to its power." The dying Mutant's own power, fixed
      // once at trigger time — same `triggerInput` convention vincent-
      // valentine-galian-beast's own `dyingCreaturePower` already
      // establishes. "During your turn" has no turn-structure gate in this
      // model (no phase/priority tracking of whose turn it is at trigger
      // time beyond what a scenario states), so it's documentary only.
      name: 'onMutantDies',
      effects: [{ kind: 'drawCard', amount: (ctx: EffectContext) => (ctx.triggerInput?.dyingCreaturePower as number) ?? 0 } satisfies Effect],
    },
  ],
};
