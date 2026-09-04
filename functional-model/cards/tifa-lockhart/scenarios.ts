import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { tifaLockhart } from './definition';

export const scenarios: Scenario[] = [
  { result: "doubles Tifa Lockhart's power until end of turn (1 -> 2)", trigger: 'onLandfall' },
  ...keywordScenarios(tifaLockhart),
];
