import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { demonWall } from './definition';

export const scenarios: Scenario[] = [{ result: 'puts two +1/+1 counters on itself' }, ...keywordScenarios(demonWall)];
