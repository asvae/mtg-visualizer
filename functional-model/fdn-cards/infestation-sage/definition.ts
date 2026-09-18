import type { CardDefinition, Effect } from '../../card';

export const infestationSage: CardDefinition = {
  name: 'Infestation Sage',
  manaCost: '{B}',
  typeLine: 'Creature — Elf Warlock',
  pt: [1, 1],

  triggers: [
    {
      name: 'onDeath',
      effects: [
        {
          kind: 'createToken',
          token: {
            name: 'Insect',
            manaCost: '0',
            types: ['Creature', 'Insect'],
            basePower: 1,
            baseToughness: 1,
            keywords: ['Flying'],
          },
          amount: 1,
        } satisfies Effect,
      ],
    },
  ],
};
