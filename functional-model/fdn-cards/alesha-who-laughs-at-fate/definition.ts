import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

// Real Forge (alesha_who_laughs_at_fate.txt): `T:Mode$ Attacks | ValidCard$
// Card.Self` — "whenever Alesha attacks," real `on:'attacks'` dispatch
// (`ValidCard$ Card.Self` scope, matches that value's own doc comment
// exactly). The Raid return trigger's own firing shape (`Mode$ Phase |
// Phase$ End of Turn | CheckSVar$ RaidTest`) is the real, now-modelable
// Raid template (`on:'endStep'` + `condition:{kind:'attackedThisTurn'}`).
// Its own EFFECT — "return target creature card with mana value <= NICKNAME's
// power" — needs a live read of THIS permanent's own current power to
// filter the graveyard pool, which no declarative `move.maxCmc` (a fixed
// number, not `Computed`) can express; a narrowly-scoped `custom` closure
// instead (genuinely functional, not a placeholder).
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
