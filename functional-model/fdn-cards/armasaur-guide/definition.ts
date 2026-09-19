import type { CardDefinition, Effect } from '../../card';

export const armasaurGuide: CardDefinition = {
  name: 'Armasaur Guide',
  provenance: 'forge-json-compiler',
  manaCost: '{4}{W}',
  typeLine: 'Creature — Dinosaur',
  pt: [4, 4],
  keywords: ['Vigilance'],
  triggers: [
    {
      name: 'onAttackersDeclared',
      cause: {
        on: 'attackersDeclared',
        attackersDeclaredMinCount: 3,
      },
      effects: [
        {
          kind: 'putCounterTarget',
          validType: 'creature',
          counterType: '+1/+1',
          amount: 1,
          owner: 'you',
        } satisfies Effect,
      ],
    },
  ],
};
