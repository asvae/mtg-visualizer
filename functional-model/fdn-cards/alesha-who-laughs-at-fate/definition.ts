import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const aleshaWhoLaughsAtFate: CardDefinition = {
  name: 'Alesha, Who Laughs at Fate',
  manaCost: '{1}{B}{R}',
  typeLine: 'Legendary Creature — Human Warrior',
  pt: [2, 2],
  keywords: ['FirstStrike'],

  triggers: [
    {
      name: 'onAttacks',
      on: 'attacks',
      effects: [{ kind: 'putCounter', target: 'self', counterType: '+1/+1', amount: 1 } satisfies Effect],
    },
    {
      name: 'onEndStepRaid',
      on: 'endStep',
      condition: { kind: 'attackedThisTurn' },
      effects: [
        {
          kind: 'custom',
          describe: "return target creature card with mana value less than or equal to Alesha's power from your graveyard to the battlefield",
          run: (ctx: EffectContext, actions: Actions) => {
            const power = ctx.self.getNetPower();
            const pool = ctx.you.getCardsIn('Graveyard').filter((c) => c.isCreature() && c.getCMC() <= power);
            const target = actions.chooseTarget(pool);
            if (target) actions.moveTo(target, 'Battlefield');
          },
        } satisfies Effect,
      ],
    },
  ],
};
