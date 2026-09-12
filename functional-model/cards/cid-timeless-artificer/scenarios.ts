import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { cidTimelessArtificer } from './definition';

export const scenarios: Scenario[] = [
  { result: 'enters the battlefield with no resolvable effect — every ability is static text (see definition.ts)' },
  ...keywordScenarios(cidTimelessArtificer),
];
