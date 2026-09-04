import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

// Real front-face mana ability (`A:AB$ Mana | Cost$ T | Produced$ Combo U R`)
// is OUT OF SCOPE (no mana-producing Effect/Action anywhere — this batch's
// own deferred-gaps list) and is omitted entirely, same as Torgal's own.
export const theEmperorOfPalamecia: CardDefinition = {
  name: 'The Emperor of Palamecia',
  manaCost: '{U}{R}',
  typeLine: 'Legendary Creature — Human Noble Wizard',

  pt: [2, 2],

  triggers: [
    {
      name: 'onNoncreatureSpellCast',
      effects: [
        {
          // "if at least four mana was spent to cast it" — this model
          // tracks no mana pool at all (same deliberate boundary the mana
          // ability above hits), so how much mana a cast spell actually
          // spent isn't a value any Computed field can read off real state.
          // Same as Kain's own damage amount: a real, player-visible fact
          // fixed at the moment of the triggering event, supplied via
          // `triggerInput` rather than guessed at.
          kind: 'custom',
          describe:
            'if at least four mana was spent to cast it, put a +1/+1 counter on The Emperor of Palamecia; then if it has three or more +1/+1 counters on it, transform it',
          run: (ctx: EffectContext, actions: Actions) => {
            const manaSpent = (ctx.triggerInput?.manaSpent as number) ?? 0;
            if (manaSpent < 4) return;
            actions.putCounter(ctx.self, '+1/+1', 1);
            if (ctx.self.getCounters('+1/+1') >= 3) {
              actions.moveTo(ctx.self, 'Exile');
              actions.moveTo(ctx.self, 'Battlefield');
            }
          },
        } satisfies Effect,
      ],
    },
  ],

  backFace: {
    name: 'The Lord Master of Hell',
    manaCost: '',
    typeLine: 'Legendary Creature — Demon Noble Wizard',

    pt: [3, 3],

    triggers: [
      {
        name: 'onAttacks',
        effects: [
          {
            kind: 'dealDamage',
            target: 'opponents',
            // `PlayerState` has no field to seed a typed (noncreature,
            // nonland) graveyard card — only `graveyardCreatureCount`
            // exists — so this is correctly authored but only
            // scenario-testable at 0 (see scenarios.ts).
            amount: (ctx) => ctx.you.getCardsIn('Graveyard').filter((c) => !c.isCreature() && !c.isLand()).length,
          } satisfies Effect,
        ],
      },
    ],
  },
};
