import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { raubahnBullOfAlaMhigo } from './definition';

export const scenarios: Scenario[] = [
  { result: 'attaches your Equipment to a creature you control', trigger: 'onAttack', you: { equipmentCount: 1, creaturesCount: 1 } },
  { result: 'no Equipment you control, nothing to attach', trigger: 'onAttack', you: { creaturesCount: 1 } },
  ...keywordScenarios(raubahnBullOfAlaMhigo),
];
