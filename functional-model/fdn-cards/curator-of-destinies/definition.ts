import type { CardDefinition, Effect } from '../../card';

export const curatorOfDestinies: CardDefinition = {
  name: 'Curator of Destinies',
  manaCost: '{4}{U}{U}',
  typeLine: 'Creature — Sphinx',
  pt: [5, 5],

  keywords: ['Flying'],

  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
      effects: [
        {
          kind: 'custom',
          describe:
            'look at top 5 cards of your library and separate into face-down/face-up piles; opponent chooses which pile goes to hand/graveyard (vocabulary gap: no pile management or opponent choice)',
          run: () => {},
        } satisfies Effect,
      ],
    },
  ],
};
