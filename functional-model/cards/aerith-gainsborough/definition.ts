import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const aerithGainsborough: CardDefinition = {
  name: 'Aerith Gainsborough',
  manaCost: '{2}{W}',
  typeLine: 'Legendary Creature — Human Cleric',

  keywords: ['Lifelink'],

  triggers: [
    {
      name: 'onLifeGained',
      effects: [{ kind: 'putCounter', target: 'self', counterType: '+1/+1', amount: 1 } satisfies Effect],
    },
    {
      name: 'onDies',
      effects: [
        {
          kind: 'custom',
          describe:
            'put X +1/+1 counters on each legendary creature you control, where X is the number of +1/+1 counters on this (real getCounters(), not a fixed/guessed value)',
          run: (ctx: EffectContext, actions: Actions) => {
            const x = ctx.self.getCounters('+1/+1');
            if (x <= 0) return;
            // Real Forge tracks "Legendary" as a SUPERTYPE, distinct from
            // this model's coarse types/subtypes (state.ts's RealCard has
            // neither) — hasSubtype('Legendary') is a pragmatic
            // approximation of that check, not a real supertype lookup.
            const legendaries = ctx.you.getCreaturesInPlay().filter((c) => c.hasSubtype('Legendary'));
            for (const creature of legendaries) actions.putCounter(creature, '+1/+1', x);
          },
        } satisfies Effect,
      ],
    },
  ],
};
