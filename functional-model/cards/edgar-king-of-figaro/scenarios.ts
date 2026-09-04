import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { edgarKingOfFigaro } from './definition';

export const scenarios: Scenario[] = [
  { result: 'draws 2 cards, one for each of the 2 artifacts you control', trigger: 'onEnter', you: { artifactsCount: 2 } },
  { result: 'no artifacts you control, draws no cards', trigger: 'onEnter', you: { artifactsCount: 0 } },
  ...keywordScenarios(edgarKingOfFigaro),
];
