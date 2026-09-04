import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { sephirothFabledSoldier } from './definition';

export const scenarios: Scenario[] = [
  { result: 'sacrifices another creature, draws a card', trigger: 'onEnterOrAttacks', you: { creaturesCount: 1 } },
  { result: 'no fodder to sacrifice; draws a card anyway (sacrifice-success gate not modeled)', trigger: 'onEnterOrAttacks', you: { creaturesCount: 0 } },
  {
    result: 'target opponent loses 1 life, you gain 1 life; not the fourth resolution this turn, no transform',
    trigger: 'onCreatureDies',
    opponents: [{}],
    triggerInput: { resolvedCount: 1 },
  },
  {
    result: 'target opponent loses 1 life, you gain 1 life, and this is the fourth resolution this turn: Sephiroth transforms',
    trigger: 'onCreatureDies',
    opponents: [{}],
    triggerInput: { resolvedCount: 4 },
  },
  { result: 'target opponent loses 1 life, you gain 1 life (the emblem/granted ability, back face)', face: 'back', trigger: 'onAnyCreatureDies', opponents: [{}] },
  {
    result: 'sacrifices 2 other creatures, draws 2 cards',
    face: 'back',
    trigger: 'onAttack',
    you: { creaturesCount: 2 },
    triggerInput: { sacCount: 2 },
  },
  { result: 'sacrifices no creatures (chosen X = 0), draws no cards', face: 'back', trigger: 'onAttack', you: { creaturesCount: 2 }, triggerInput: { sacCount: 0 } },
  ...keywordScenarios(sephirothFabledSoldier),
];
