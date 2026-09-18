import type { CardDefinition, Effect } from '../../card';

export const grapplingKraken: CardDefinition = {
  name: 'Grappling Kraken',
  manaCost: '{4}{U}{U}',
  typeLine: 'Creature — Kraken',
  pt: [5, 6],

  triggers: [
    {
      name: 'onLandfall',
      effects: [
        {
          kind: 'tapTarget',
          validType: 'creature',
          owner: 'opponents',
        } satisfies Effect,
        {
          kind: 'putCounterTarget',
          validType: 'creature',
          counterType: 'stun',
          amount: 1,
          owner: 'opponents',
        } satisfies Effect,
      ],
    },
  ],
};
