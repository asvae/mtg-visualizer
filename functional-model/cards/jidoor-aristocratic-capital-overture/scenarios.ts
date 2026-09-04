import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'enters tapped', trigger: 'onEnter' },
  { result: 'mills 3 cards (opponent has 7 in library, half rounded down)', face: 'back', castFrom: 'hand', opponents: [{ libraryCount: 7 }] },
  { result: 'mills 0 cards (opponent has an empty library)', face: 'back', castFrom: 'hand', opponents: [{}] },
];
