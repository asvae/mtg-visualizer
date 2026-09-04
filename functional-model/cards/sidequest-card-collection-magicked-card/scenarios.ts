import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'draws three cards, then discards two', trigger: 'onEnter', you: { handCount: 2 } },
  { result: 'no resolvable effect in this model (transform is not tracked as state)', trigger: 'onEndStep' },
  { result: 'back face: Magicked Card, a 4/4 flying Vehicle, enters as itself', face: 'back' },
];
