import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { diamondWeapon } from './definition';

export const scenarios: Scenario[] = [{ result: 'enters the battlefield, no resolvable effect (a vanilla body plus real static text — see definition.ts comment)' }, ...keywordScenarios(diamondWeapon)];
