import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

// Real script (sephiroth_planets_heir.txt).
export const sephirothPlanetsHeir: CardDefinition = {
  name: "Sephiroth, Planet's Heir",
  manaCost: '{4}{U}{B}',
  typeLine: 'Legendary Creature — Human Avatar Soldier',

  pt: [4, 4],
  keywords: ['Vigilance'],

  triggers: [
    {
      // "creatures your opponents control get -2/-2 until end of turn" —
      // `pumpAll`'s own declarative `predicate` only covers
      // `'creatures-you-control'` (see card.ts's own doc comment: "extend
      // the union as more predicates show up"), no opponents-controlled
      // shape exists yet — `custom` composing the real `actions.pump` over
      // each opponent's own creatures instead, same "no new capability
      // invented, just a declarative shape not built yet" reasoning
      // ultimecia-temporal-threat's own "tap all opponents' creatures"
      // custom effect uses for the identical gap.
      name: 'onEnter',
      effects: [
        {
          kind: 'custom',
          describe: 'creatures your opponents control get -2/-2 until end of turn',
          run: (ctx: EffectContext, actions: Actions) => {
            for (const opp of ctx.opponents) for (const creature of opp.getCreaturesInPlay()) actions.pump(creature, -2, -2);
          },
        } satisfies Effect,
      ],
    },
    {
      name: 'onOpponentCreatureDies',
      effects: [{ kind: 'putCounter', target: 'self', counterType: '+1/+1', amount: 1 } satisfies Effect],
    },
  ],
};
