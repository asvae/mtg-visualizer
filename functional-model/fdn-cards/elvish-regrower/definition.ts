import type { CardDefinition, Effect } from '../../card';

export const elvishRegrower: CardDefinition = {
  name: 'Elvish Regrower',
  manaCost: '{2}{G}{G}',
  typeLine: 'Creature — Elf Druid',
  pt: [4, 3],

  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
      effects: [
        {
          kind: 'move',
          owner: 'you',
          from: 'Graveyard',
          to: 'Hand',
          validType: 'any',
          qty: 1,
          target: true,
        } satisfies Effect,
      ],
    },
  ],
};
