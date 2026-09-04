import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { freyaCrescent } from './definition';

export const scenarios: Scenario[] = [
  { result: 'enters the battlefield, no other effect (Jump and the mana ability are not modeled — see definition.ts comment)' },
  ...keywordScenarios(freyaCrescent),
];
