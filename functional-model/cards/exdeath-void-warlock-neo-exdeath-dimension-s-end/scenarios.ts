import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { exdeathVoidWarlock } from './definition';

export const scenarios: Scenario[] = [
  { result: 'you gain 3 life', trigger: 'onEnter' },
  { result: 'transforms into Neo Exdeath, Dimension\'s End (6+ permanent cards in the graveyard)', trigger: 'onEndStep', you: { graveyardCreatureCount: 6 } },
  { result: 'stays Exdeath, Void Warlock (fewer than 6 permanent cards in the graveyard)', trigger: 'onEndStep', you: { graveyardCreatureCount: 2 } },
  ...keywordScenarios(exdeathVoidWarlock),
];
