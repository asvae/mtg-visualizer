import type { CardDefinition, Effect } from '../../card';

export const ashrootAnimist: CardDefinition = {
  name: 'Ashroot Animist',
  manaCost: '{2}{R}{G}',
  typeLine: 'Creature — Lizard Druid',
  pt: [4, 4],
  keywords: ['Trample'],

  triggers: [
    {
      name: 'onAttacks',
      on: 'attacks',
      effects: [
        {
          kind: 'pumpTarget',
          power: (ctx) => ctx.self.getNetPower(),
          toughness: (ctx) => ctx.self.getNetPower(),
          owner: 'you',
          notSelf: true,
          untilEndOfTurn: true,
        } satisfies Effect,
        { kind: 'grantKeywordTarget', keyword: 'Trample', validType: 'creature', owner: 'you', notSelf: true, untilEndOfTurn: true } satisfies Effect,
      ],
    },
  ],
};
