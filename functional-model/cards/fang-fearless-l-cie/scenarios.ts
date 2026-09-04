import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { fangFearlessLcie } from './definition';

export const scenarios: Scenario[] = [
  { result: 'draws a card and loses 1 life', trigger: 'onGraveyardCardsLeave' },
  ...keywordScenarios(fangFearlessLcie),
];
