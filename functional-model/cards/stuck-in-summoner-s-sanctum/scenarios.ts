import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { stuckInSummonersSanctum } from './definition';

export const scenarios: Scenario[] = [
  // `sequence` (not a bare `trigger`) so this scenario's own trace shows a
  // real cast -> enters -> ETB lifecycle (harness.ts's own `lifecycleBefore`
  // otherwise suppresses cast/enters entirely for a bare `trigger` scenario)
  // — this card's baseline `self-cast`/`self-enters` facts need that real
  // evidence, same as ice-flan/coeurl's own onEnter scenarios.
  { result: 'taps the enchanted permanent', sequence: ['onEnter'], you: { creaturesCount: 1 } },
  ...keywordScenarios(stuckInSummonersSanctum),
];
