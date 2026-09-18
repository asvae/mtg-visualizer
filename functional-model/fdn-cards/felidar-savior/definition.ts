import type { CardDefinition, Effect } from '../../card';
import { applyToBound, putCounter, selectUpTo, you } from '../../combinator';

export const felidarSavior: CardDefinition = {
  name: 'Felidar Savior',
  manaCost: '{3}{W}',
  typeLine: 'Creature — Cat Beast',
  pt: [2, 3],
  keywords: ['Lifelink'],

  // "When this creature enters, put a +1/+1 counter on each of up to two
  // other target creatures you control."
  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
      effects: [
        {
          kind: 'program',
          describe: 'put a +1/+1 counter on each of up to two other target creatures you control',
          program: selectUpTo(you.creaturesInPlay().filter('excludeSelf'), 2, 'target', [
            applyToBound('target', 0, putCounter('+1/+1', 1)),
            applyToBound('target', 1, putCounter('+1/+1', 1)),
          ]),
        } satisfies Effect,
      ],
    },
  ],
};
