import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { garnetPrincessOfAlexandria } from './definition';

export const scenarios: Scenario[] = [
  // `PlayerState` has no field to seed a Saga permanent (let alone one with
  // LORE counters on it) — this is the honest 0-Saga outcome; see definition.ts.
  { result: 'no Sagas you control, so no +1/+1 counters are put on Garnet', trigger: 'onAttacks' },
  ...keywordScenarios(garnetPrincessOfAlexandria),
];
