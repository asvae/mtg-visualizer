import type { CardDefinition, Effect } from '../../card';

export const bloodthirstyConqueror: CardDefinition = {
  name: 'Bloodthirsty Conqueror',
  manaCost: '{3}{B}{B}',
  typeLine: 'Creature — Vampire Knight',
  pt: [5, 5],

  keywords: ['Flying', 'Deathtouch'],

  triggers: [
    {
      name: 'onOpponentLifeLoss',
      effects: [
        {
          kind: 'gainLife',
          amount: (ctx) => (ctx.triggerInput?.lifeAmount as number) ?? 0,
        } satisfies Effect,
      ],
    },
  ],
};
