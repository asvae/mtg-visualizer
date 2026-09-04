import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { coliseumBehemoth } from './definition';

export const scenarios: Scenario[] = [
  { result: 'mode 0: destroys the target artifact', trigger: 'onEnter', mode: 0, opponents: [{ artifactsCount: 1 }] },
  { result: 'mode 0: no artifact or enchantment to destroy, no effect', trigger: 'onEnter', mode: 0, opponents: [{ creaturesCount: 1 }] },
  { result: 'mode 1: draws a card', trigger: 'onEnter', mode: 1, you: { libraryCount: 1 } },
  ...keywordScenarios(coliseumBehemoth),
];
