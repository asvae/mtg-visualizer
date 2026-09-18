import type { CardDefinition, Effect } from '../../card';

export const homunculusHorde: CardDefinition = {
  name: 'Homunculus Horde',
  manaCost: '{3}{U}',
  typeLine: 'Creature — Homunculus',
  pt: [2, 2],

  triggers: [
    {
      name: 'onSecondDraw',
      effects: [
        {
          kind: 'custom',
          describe: 'create a token that\'s a copy of this creature (vocabulary gap: no copy effect)',
          run: () => {},
        } satisfies Effect,
      ],
    },
  ],
};
