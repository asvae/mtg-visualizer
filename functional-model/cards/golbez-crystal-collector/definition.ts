import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const golbezCrystalCollector: CardDefinition = {
  name: 'Golbez, Crystal Collector',
  manaCost: '{U}{B}',
  typeLine: 'Legendary Creature — Human Wizard',

  pt: [1, 4],

  triggers: [
    {
      name: 'onArtifactEnters',
      effects: [{ kind: 'surveil', qty: 1 } satisfies Effect],
    },
    {
      // "If you control four or more artifacts, return target creature
      // card from your graveyard to your hand. Then if you control eight
      // or more artifacts, each opponent loses life equal to that card's
      // power." A two-stage threshold gate PLUS reading the returned
      // card's own real power back into a second effect's amount — no
      // combination of `move`/`loseLife` can gate on a real artifact count
      // OR feed one effect's outcome into the next declaratively, so this
      // is genuinely a `custom` case, not a shortcut around one.
      name: 'onEndStep',
      effects: [
        {
          kind: 'custom',
          describe:
            "if you control four or more artifacts, return target creature card from your graveyard to your hand; then if you control eight or more artifacts, each opponent loses life equal to that card's power",
          run: (ctx: EffectContext, actions: Actions) => {
            const artifactCount = ctx.you.getCardsIn('Battlefield').filter((c) => c.isArtifact()).length;
            if (artifactCount < 4) return;
            const pool = ctx.you.getCardsIn('Graveyard').filter((c) => c.isCreature());
            if (pool.length === 0) return;
            const target = actions.chooseTarget(pool);
            const power = target.getNetPower();
            actions.moveTo(target, 'Hand');
            if (artifactCount >= 8) {
              for (const opponent of ctx.opponents) opponent.loseLife(power);
            }
          },
        } satisfies Effect,
      ],
    },
  ],
};
