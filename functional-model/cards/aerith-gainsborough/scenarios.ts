import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { aerithGainsborough } from './definition';

export const scenarios: Scenario[] = [
  { result: 'puts a +1/+1 counter on itself', trigger: 'onLifeGained' },
  {
    result: 'puts 2 +1/+1 counters on each legendary creature it controls, including itself',
    trigger: 'onDies',
    selfCounters: { '+1/+1': 2 },
    you: { creaturesCount: 1, creatureSubtypes: ['Legendary'] },
  },
  {
    result: 'no other legendary creature present, but it still counts itself: puts 2 +1/+1 counters on itself',
    trigger: 'onDies',
    selfCounters: { '+1/+1': 2 },
    you: { creaturesCount: 1 },
  },
  { result: 'no counters on itself, no effect', trigger: 'onDies', selfCounters: {}, you: { creaturesCount: 1 } },
  ...keywordScenarios(aerithGainsborough),
];
