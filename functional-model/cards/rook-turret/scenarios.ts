import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { rookTurret } from './definition';

export const scenarios: Scenario[] = [
  { result: 'draws a card, then discards a card', trigger: 'onArtifactEnters', you: { handCount: 2 } },
  ...keywordScenarios(rookTurret),
];
