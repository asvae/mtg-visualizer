import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const fiendishPanda: CardDefinition = {
  name: 'Fiendish Panda',
  manaCost: '{2}{W}{B}',
  typeLine: 'Creature — Bear Demon',
  pt: [3, 2],

  triggers: [
    {
      name: 'onGainLife',
      effects: [{ kind: 'putCounter', target: 'self', counterType: '+1/+1', amount: 1 } satisfies Effect],
    },
    {
      name: 'onDies',
      effects: [
        {
          kind: 'custom',
          describe:
            "return another target non-Bear creature card with mana value less than or equal to this creature's power from your graveyard to the battlefield",
          run: (ctx: EffectContext, actions: Actions) => {
            const power = ctx.self.getNetPower();
            const pool = ctx.you
              .getCardsIn('Graveyard')
              .filter((c) => c.isCreature() && !c.hasSubtype('Bear') && c.getId() !== ctx.self.getId() && c.getCMC() <= power);
            const target = actions.chooseTarget(pool);
            if (target) actions.moveTo(target, 'Battlefield');
          },
        } satisfies Effect,
      ],
    },
  ],
};
