import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { granPulseOchu } from './definition';

export const scenarios: Scenario[] = [
  { result: 'gets +3/+3 until end of turn (3 permanent cards in your graveyard)', you: { graveyardCreatureCount: 3 } },
  { result: 'gets +0/+0 (no permanent cards in your graveyard)', you: { graveyardCreatureCount: 0 } },
  ...keywordScenarios(granPulseOchu),
];
