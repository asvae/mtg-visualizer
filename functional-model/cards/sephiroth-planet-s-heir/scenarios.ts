import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { sephirothPlanetsHeir } from './definition';

export const scenarios: Scenario[] = [
  { result: "each opponent's creatures get -2/-2 until end of turn", trigger: 'onEnter', opponents: [{ creaturesCount: 2 }] },
  { result: 'puts a +1/+1 counter on Sephiroth, Planet\'s Heir', trigger: 'onOpponentCreatureDies' },
  ...keywordScenarios(sephirothPlanetsHeir),
];
