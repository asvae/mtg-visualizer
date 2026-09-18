import type { CardDefinition, Effect } from '../../card';

export const dazzlingAngel: CardDefinition = {
  name: 'Dazzling Angel',
  manaCost: '{2}{W}',
  typeLine: 'Creature — Angel',
  pt: [2, 3],
  keywords: ['Flying'],

  triggers: [
    {
      name: 'onOtherCreatureEnter',
      on: 'otherPermanentEnters',
      otherPermanentEntersMatch: { sameController: true },
      effects: [
        {
          kind: 'gainLife',
          amount: 1,
        } satisfies Effect,
      ],
    },
  ],
};
