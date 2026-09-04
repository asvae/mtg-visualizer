import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { yshtolaRhul } from './definition';

export const scenarios: Scenario[] = [
  { result: 'exiles itself (the first pool candidate) and returns it to the battlefield', trigger: 'onEndStep' },
  {
    result: 'exiles the other (nontoken) creature it controls and returns it to the battlefield',
    trigger: 'onEndStep',
    you: { creaturesCount: 1, nontokenCreaturesCount: 1 },
  },
  {
    // A generated filler TOKEN creature really does cease to exist once
    // exiled (real rule 111.7 — see this card's own `definition.ts` comment),
    // so the second `moveTo` back to the battlefield is correctly skipped.
    result: 'exiles the other (token) creature it controls; it ceases to exist and does not return',
    trigger: 'onEndStep',
    you: { creaturesCount: 1 },
  },
  ...keywordScenarios(yshtolaRhul),
];
