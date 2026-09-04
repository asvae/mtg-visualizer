import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { xandeDarkMage } from './definition';

export const scenarios: Scenario[] = [
  { result: 'creature enters, no resolvable effect (the P/T bonus is a real CDA with no matching ptFormula shape — see definition.ts comment)' },
  ...keywordScenarios(xandeDarkMage),
];
