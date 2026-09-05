import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { thranduilSindarinLiege } from './definition';

export const scenarios: Scenario[] = [
  { result: 'creates a 1/1 green Elf creature token (its own +1/+1 anthem for other Elves is not modeled — no continuous static-buff engine here)', trigger: 'onLandfall' },
  ...keywordScenarios(thranduilSindarinLiege),
  {
    result: 'mills four cards, then puts up to two land cards from among them into hand',
    face: 'back',
    you: { libraryCount: 4, libraryLandCount: 2 },
  },
  {
    result: 'no lands among the four milled cards — puts nothing into hand',
    face: 'back',
    you: { libraryCount: 4 },
  },
];
