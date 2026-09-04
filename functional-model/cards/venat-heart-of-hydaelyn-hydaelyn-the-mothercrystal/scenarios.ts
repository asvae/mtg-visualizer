import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { venatHeartOfHydaelyn } from './definition';

export const scenarios: Scenario[] = [
  { result: 'draws a card', trigger: 'onCastLegendarySpell' },
  {
    result: 'exiles the target nonland permanent, then exiles and returns Venat transformed into Hydaelyn, the Mothercrystal',
    opponents: [{ creaturesCount: 1 }],
  },
  { result: 'no nonland permanent to exile, still exiles and returns Venat transformed', opponents: [{ landsCount: 2 }] },
  {
    result: 'puts a +1/+1 counter on the other legendary creature you control and draws a card',
    face: 'back',
    trigger: 'onBeginCombat',
    you: { creaturesCount: 1, creatureSubtypes: ['Legendary'] },
  },
  {
    result: 'puts a +1/+1 counter on the other (non-legendary) creature you control, no card drawn',
    face: 'back',
    trigger: 'onBeginCombat',
    you: { creaturesCount: 1 },
  },
  { result: 'no other creature you control, no-op', face: 'back', trigger: 'onBeginCombat', you: { creaturesCount: 0 } },
  ...keywordScenarios(venatHeartOfHydaelyn),
];
