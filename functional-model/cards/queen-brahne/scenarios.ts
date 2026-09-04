import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { queenBrahne } from './definition';

export const scenarios: Scenario[] = [{ result: 'creates a 0/1 black Wizard creature token', trigger: 'onAttack' }, ...keywordScenarios(queenBrahne)];
