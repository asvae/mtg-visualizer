import type { CardDefinition, Effect } from '../../card';

export const homunculusHorde: CardDefinition = {
  name: 'Homunculus Horde',
  manaCost: '{3}{U}',
  typeLine: 'Creature — Homunculus',
  pt: [2, 2],

  missingSchemaFunctionality: [
    {
      clause: "create a token that's a copy of this creature",
      demand: 'No "copy a permanent" mechanic exists anywhere in this engine (CR 707) — `createToken` only ever builds a fixed, hand-authored `TokenInfo` payload, never a live copy of the source card\'s own current characteristics.',
    },
  ],

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
