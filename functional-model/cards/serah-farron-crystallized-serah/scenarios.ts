import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { serahFarron } from './definition';

export const scenarios: Scenario[] = [
  {
    result: 'you control two other legendary creatures: Serah Farron transforms (exiled and returned, standing in for the in-place flip)',
    trigger: 'onBeginCombat',
    you: { creaturesCount: 2, creatureSubtypes: ['Legendary'] },
  },
  {
    result: 'only one other legendary creature — condition not met, no transform',
    trigger: 'onBeginCombat',
    you: { creaturesCount: 1, creatureSubtypes: ['Legendary'] },
  },
  { result: 'back face: static-only permanent, no resolvable effects (cost reduction and the +2/+2 anthem are both continuous text)', face: 'back' },
  ...keywordScenarios(serahFarron),
];
