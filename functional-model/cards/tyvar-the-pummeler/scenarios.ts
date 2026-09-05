import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { tyvarThePummeler } from './definition';

export const scenarios: Scenario[] = [
  { result: 'enters the battlefield, no other effect (both activated abilities fire separately below)' },
  { result: 'gains indestructible until end of turn', ability: 'indestructible' },
  {
    result: 'creatures you control get +X/+X until end of turn, where X is the greatest power among them (3)',
    ability: 'pump',
    you: { creaturesCount: 1, nontokenCreaturesCount: 1, creaturePower: 3 },
  },
  { result: 'no other creatures — X is Tyvar\'s own power (3)', ability: 'pump', you: { creaturesCount: 0 } },
  ...keywordScenarios(tyvarThePummeler),
];
