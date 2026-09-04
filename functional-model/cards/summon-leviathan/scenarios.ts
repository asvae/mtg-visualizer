import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { summonLeviathan } from './definition';

export const scenarios: Scenario[] = [
  { result: 'returns your 2 non-tribal creatures to hand', trigger: 'chapterI', you: { creaturesCount: 2 } },
  {
    result: "returns the opponent's non-tribal creature to hand; your own Merfolk stays (an exempt subtype)",
    trigger: 'chapterI',
    you: { creaturesCount: 1, creatureSubtypes: ['Merfolk'] },
    opponents: [{ creaturesCount: 1 }],
  },
  { result: 'no resolvable effect in this model (a temporary granted delayed trigger is not tracked)', trigger: 'chapterII' },
  { result: 'no resolvable effect in this model (a temporary granted delayed trigger is not tracked)', trigger: 'chapterIII' },
  ...keywordScenarios(summonLeviathan),
];
