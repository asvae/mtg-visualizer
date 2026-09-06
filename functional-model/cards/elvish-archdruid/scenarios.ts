import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { elvishArchdruid } from './definition';

export const scenarios: Scenario[] = [
  { result: 'enters the battlefield, no other effect (the anthem is documentary text — see definition.ts comment)' },
  { result: 'adds {G} for each Elf you control — itself only (1 Elf, itself)', you: { creaturesCount: 0 } },
  { result: 'adds {G} for each Elf you control — itself plus 2 other Elves (3 total)', you: { creaturesCount: 2, creatureSubtypes: ['Elf'] } },
  ...keywordScenarios(elvishArchdruid),
];
