import type { CardDefinition, Effect } from '../../card';

export const vanguardSeraph: CardDefinition = {
  name: 'Vanguard Seraph',
  provenance: 'forge-json-compiler',
  manaCost: '{3}{W}',
  typeLine: 'Creature — Angel Warrior',
  pt: [3, 3],
  keywords: ['Flying'],
  triggers: [
    {
      name: 'onLifeGained',
      cause: {
        on: 'lifeGained',
        activationLimit: 1,
      },
      effects: [
        {
          kind: 'surveil',
          qty: 1,
        } satisfies Effect,
      ],
    },
  ],
};
