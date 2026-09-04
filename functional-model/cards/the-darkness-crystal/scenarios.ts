import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { theDarknessCrystal } from './definition';

export const scenarios: Scenario[] = [
  // Only the "no legal target" branch is exercisable here — `PlayerState`
  // (harness.ts) has no field to seed cards into the Exile zone at all
  // (`setupPlayer` only populates Hand/Library/Graveyard/Battlefield), so
  // this card's own "found a target" branch (return it tapped with 2
  // counters) can't be scenario-tested with the current harness. Flagged
  // to the parent session as a real PlayerState/setupPlayer gap.
  { result: 'no creature card in your exile zone, nothing returned' },
  ...keywordScenarios(theDarknessCrystal),
];
