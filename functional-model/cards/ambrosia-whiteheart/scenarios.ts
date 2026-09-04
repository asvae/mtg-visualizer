import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { ambrosiaWhiteheart } from './definition';

export const scenarios: Scenario[] = [
  { result: "returns the other permanent to its owner's hand", trigger: 'onEnter', you: { creaturesCount: 1 } },
  { result: 'no other permanent to bounce, no effect', trigger: 'onEnter', you: { creaturesCount: 0 } },
  { result: 'gets +1/+0 until end of turn', trigger: 'onLandfall' },
  ...keywordScenarios(ambrosiaWhiteheart),
];
