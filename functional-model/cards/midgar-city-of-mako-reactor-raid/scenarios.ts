import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'enters tapped', trigger: 'onEnter' },
  {
    result: 'sacrifices a creature, then draws 2 cards',
    face: 'back',
    castFrom: 'hand',
    you: { creaturesCount: 1, libraryCount: 2 },
  },
];
