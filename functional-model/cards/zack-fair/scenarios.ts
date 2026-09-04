import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { zackFair } from './definition';

export const scenarios: Scenario[] = [
  { result: 'enters with a +1/+1 counter on itself', trigger: 'onEnter' },
  {
    result:
      "puts Zack Fair's 2 +1/+1 counters onto the target creature you control (indestructible grant and Equipment-transfer not mechanically enforced — see definition.ts's own comments)",
    selfCounters: { '+1/+1': 2 },
    you: { creaturesCount: 1 },
  },
  { result: 'no other creature you control to target, no counters moved', selfCounters: { '+1/+1': 2 }, you: { creaturesCount: 0 } },
  ...keywordScenarios(zackFair),
];
