import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const garnetPrincessOfAlexandria: CardDefinition = {
  name: 'Garnet, Princess of Alexandria',
  manaCost: '{G}{W}',
  typeLine: 'Legendary Creature — Human Noble Cleric',

  pt: [2, 2],
  keywords: ['Lifelink'],

  triggers: [
    {
      name: 'onAttacks',
      effects: [
        {
          // No `removeCounter`/decrement action exists anywhere in
          // `Actions` (`putCounter` only ever adds) — real "remove a lore
          // counter from each of any number of Sagas you control" can't
          // actually decrement those Sagas' own counters. Modeled the same
          // read-only-stand-in way `state.ts`'s own `surveil` already is
          // (real library reordering isn't tracked either, kept log-only
          // rather than fabricating a mutation): sums the LORE counters
          // currently on Sagas you control (without zeroing them) and puts
          // that many +1/+1 counters on Garnet.
          kind: 'custom',
          describe:
            'you may remove a lore counter from each of any number of Sagas you control; put a +1/+1 counter on Garnet for each lore counter removed this way (no removeCounter action exists — read-only: counts current LORE counters without decrementing them)',
          run: (ctx: EffectContext, actions: Actions) => {
            const sagas = ctx.you.getCardsIn('Battlefield').filter((c) => c.hasSubtype('Saga'));
            const totalLore = sagas.reduce((sum, s) => sum + s.getCounters('LORE'), 0);
            if (totalLore > 0) actions.putCounter(ctx.self, '+1/+1', totalLore);
          },
        } satisfies Effect,
      ],
    },
  ],
};
