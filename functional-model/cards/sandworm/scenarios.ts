import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { sandworm } from './definition';

export const scenarios: Scenario[] = [
  {
    result: "destroys the opponent's target land; its controller finds a basic land in their library, puts it onto the battlefield tapped",
    trigger: 'onEnter',
    opponents: [{ landsCount: 1, libraryCount: 3 }],
  },
  { result: 'no basic land in the library to find; the destroyed land is simply gone', trigger: 'onEnter', opponents: [{ landsCount: 1 }] },
  ...keywordScenarios(sandworm),
];
