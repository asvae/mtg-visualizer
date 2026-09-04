import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { bartzAndBoko } from './definition';

export const scenarios: Scenario[] = [
  {
    result: 'each of the 2 other Birds you control (power 2 each) deals 2 damage to the target creature an opponent controls (4 total)',
    trigger: 'onEnter',
    you: { creaturesCount: 2, creatureSubtypes: ['Bird'], creaturePower: 2 },
    opponents: [{ creaturesCount: 1 }],
  },
  { result: 'no other Birds you control, no damage dealt', trigger: 'onEnter', you: { creaturesCount: 0 }, opponents: [{ creaturesCount: 1 }] },
  { result: 'no legal target (opponent controls no creatures), no effect', trigger: 'onEnter', you: { creaturesCount: 1, creatureSubtypes: ['Bird'] }, opponents: [{ creaturesCount: 0 }] },
  ...keywordScenarios(bartzAndBoko),
];
