import type { CardDefinition, Effect, EffectContext } from '../../card';

export const hareApparent: CardDefinition = {
  name: 'Hare Apparent',
  manaCost: '{1}{W}',
  typeLine: 'Creature — Rabbit Noble',
  pt: [2, 2],

  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
      effects: [
        {
          kind: 'createToken',
          token: {
            name: 'Rabbit',
            manaCost: '0',
            types: ['Creature', 'Rabbit'],
            basePower: 1,
            baseToughness: 1,
          },
          amount: (ctx: EffectContext) => {
            // Count other creatures you control named Hare Apparent
            return ctx.you
              .getCreaturesInPlay()
              .filter((c) => c.getName() === 'Hare Apparent' && c.getId() !== ctx.self.getId()).length;
          },
        } satisfies Effect,
      ],
    },
  ],
};
