import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { valkyrieAerialUnit } from './definition';

export const scenarios: Scenario[] = [{ result: 'surveils 2', trigger: 'onEnter' }, ...keywordScenarios(valkyrieAerialUnit)];
