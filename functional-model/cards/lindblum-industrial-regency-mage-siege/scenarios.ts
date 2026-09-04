import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'enters tapped', trigger: 'onEnter' },
  {
    result: 'creates a 0/1 black Wizard creature token (its granted "deals 1 damage on noncreature cast" ability is not modeled — see definition.ts)',
    face: 'back',
    castFrom: 'hand',
  },
];
