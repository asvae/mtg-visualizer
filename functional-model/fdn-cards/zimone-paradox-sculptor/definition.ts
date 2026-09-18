import type { CardDefinition, Effect } from '../../card';
import { applyToBound, putCounter, selectUpTo, you } from '../../combinator';

export const zimoneParadoxSculptor: CardDefinition = {
  name: 'Zimone, Paradox Sculptor',
  manaCost: '{2}{G}{U}',
  typeLine: 'Legendary Creature — Human Wizard',
  pt: [1, 4],

  triggers: [
    {
      name: 'onBeginCombat',
      effects: [
        {
          kind: 'program',
          describe: 'put a +1/+1 counter on each of up to two target creatures you control',
          program: selectUpTo(you.creaturesInPlay(), 2, 'target', [
            applyToBound('target', 0, putCounter('+1/+1', 1)),
            applyToBound('target', 1, putCounter('+1/+1', 1)),
          ]),
        } satisfies Effect,
      ],
    },
  ],

  missingSchemaFunctionality: [
    {
      clause: 'Double the number of each kind of counter on up to two target creatures and/or artifacts you control.',
      demand:
        'No `ValueRef` reads a previously-BOUND target\'s own live counter count (only `selfCounters`, scoped to `ctx.self`), and no primitive enumerates "every counter type currently on an object" to double each independently.',
    },
  ],
};
