import type { CardDefinition, Effect } from '../../card';

export const mossbornHydra: CardDefinition = {
  name: 'Mossborn Hydra',
  manaCost: '{2}{G}',
  typeLine: 'Creature — Elemental Hydra',
  pt: [0, 0],
  keywords: ['Trample'],

  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
      effects: [{ kind: 'putCounter', target: 'self', counterType: '+1/+1', amount: 1 } satisfies Effect],
    },
    {
      name: 'onLandfallDouble',
      effects: [
        {
          kind: 'putCounter',
          target: 'self',
          counterType: '+1/+1',
          amount: (ctx) => ctx.self.getCounters('+1/+1'),
        } satisfies Effect,
      ],
    },
  ],
};
