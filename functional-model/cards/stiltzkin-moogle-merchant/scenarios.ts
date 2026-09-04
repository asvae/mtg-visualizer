import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { stiltzkinMoogleMerchant } from './definition';

export const scenarios: Scenario[] = [
  { result: 'gives the opponent control of the artifact, draws a card', you: { artifactsCount: 1 }, opponents: [{}] },
  { result: 'no other permanent to give away, no-op', opponents: [{}] },
  ...keywordScenarios(stiltzkinMoogleMerchant),
];
