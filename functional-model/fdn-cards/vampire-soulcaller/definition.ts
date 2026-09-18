import type { CardDefinition, Effect } from '../../card';

export const vampireSoulcaller: CardDefinition = {
  name: 'Vampire Soulcaller',
  manaCost: '{4}{B}',
  typeLine: 'Creature — Vampire Warlock',
  pt: [3, 2],

  keywords: ['Flying'],
  staticAbilities: ["This creature can't block."],

  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
      effects: [
        {
          kind: 'move',
          from: 'Graveyard',
          to: 'Hand',
          qty: 1,
          validType: 'creature',
          owner: 'you',
          target: true,
        } satisfies Effect,
      ],
    },
  ],
};
