import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { hopeEstheim } from './definition';

export const scenarios: Scenario[] = [
  { result: 'each opponent mills 3 cards (you gained 3 life this turn)', trigger: 'onEndStep', triggerInput: { lifeGainedThisTurn: 3 }, opponents: [{ libraryCount: 5 }] },
  { result: 'no life gained this turn, no cards milled', trigger: 'onEndStep', triggerInput: { lifeGainedThisTurn: 0 }, opponents: [{ libraryCount: 5 }] },
  ...keywordScenarios(hopeEstheim),
];
