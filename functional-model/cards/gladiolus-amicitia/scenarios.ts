import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { gladiolusAmicitia } from './definition';

export const scenarios: Scenario[] = [
  {
    result: 'searches for a land and puts it onto the battlefield (no land-typed library filler exists in this model to actually match, see definition.ts)',
    trigger: 'onEnter',
    you: { libraryCount: 1 },
  },
  { result: 'the other creature you control gets +2/+2 and gains trample until end of turn', trigger: 'onLandfall', you: { creaturesCount: 1 } },
  ...keywordScenarios(gladiolusAmicitia),
];
