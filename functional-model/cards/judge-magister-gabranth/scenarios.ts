import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { judgeMagisterGabranth } from './definition';

export const scenarios: Scenario[] = [
  { result: 'puts a +1/+1 counter on itself', trigger: 'onCreatureOrArtifactDies' },
  ...keywordScenarios(judgeMagisterGabranth),
];
