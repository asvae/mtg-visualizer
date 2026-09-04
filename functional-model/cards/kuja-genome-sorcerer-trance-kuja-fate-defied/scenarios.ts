import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { kujaGenomeSorcerer } from './definition';

export const scenarios: Scenario[] = [
  { result: 'creates a tapped 0/1 black Wizard creature token (fewer than 4 Wizards controlled, no transform)', trigger: 'onEndStep', you: { creaturesCount: 0 } },
  {
    result: 'creates the Wizard token, then (now controlling 4 Wizards) exiles Kuja and returns it transformed into Trance Kuja, Fate Defied',
    trigger: 'onEndStep',
    you: { creaturesCount: 3, creatureSubtypes: ['Wizard'] },
  },
  ...keywordScenarios(kujaGenomeSorcerer),
];
