import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { theRegalia } from './definition';

export const scenarios: Scenario[] = [
  { result: 'reveals cards until a land is found and puts it onto the battlefield tapped (not modeled — see definition.ts)', trigger: 'onAttacks' },
  ...keywordScenarios(theRegalia),
];
