import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { rinoaHeartilly } from './definition';

export const scenarios: Scenario[] = [
  { result: 'creates a legendary 1/1 green and white Dog creature token named Angelo', trigger: 'onEnter' },
  {
    result: 'the other creature you control gets +2/+2 until end of turn (2 creatures you control)',
    trigger: 'onAttacks',
    you: { creaturesCount: 1 },
  },
  ...keywordScenarios(rinoaHeartilly),
];
