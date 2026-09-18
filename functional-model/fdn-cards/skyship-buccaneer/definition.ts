import type { CardDefinition } from '../../card';

export const skyshipBuccaneer: CardDefinition = {
  name: 'Skyship Buccaneer',
  manaCost: '{3}{U}{U}',
  typeLine: 'Creature — Human Pirate',
  pt: [4, 3],
  keywords: ['Flying'],
  triggers: [
    {
      name: 'RaidETB',
      condition: 'enters-battlefield',
      description: 'Raid — When this creature enters, if you attacked this turn, draw a card.',
      effects: [
        {
          kind: 'custom',
          describe: 'If you attacked this turn, draw a card (Raid mechanic with turn-state check)',
          run: (ctx) => {},
        },
      ],
    },
  ],
};
