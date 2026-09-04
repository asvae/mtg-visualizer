import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { tidusBlitzballStar } from './definition';

export const scenarios: Scenario[] = [
  { result: 'puts a +1/+1 counter on itself', trigger: 'onArtifactEnters' },
  { result: 'taps a target creature an opponent controls', trigger: 'onAttacks', opponents: [{ creaturesCount: 1 }] },
  { result: 'no opposing creature, no legal target', trigger: 'onAttacks', opponents: [{ creaturesCount: 0 }] },
  ...keywordScenarios(tidusBlitzballStar),
];
