import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { torgalAFineHound } from './definition';

export const scenarios: Scenario[] = [
  {
    // The generated Human creature stands in for "the creature you just
    // cast" (see definition.ts's own comment) — it's added to the battlefield
    // BEFORE self, so `chooseTarget`'s deterministic first-candidate pick
    // lands on it, not on Torgal itself. Torgal (a Wolf) is the only real
    // Dog/Wolf you control here, so the count is 1.
    result: 'puts 1 +1/+1 counter on the newly cast Human creature (Torgal itself is the only Dog/Wolf you control)',
    trigger: 'onFirstHumanCreatureCast',
    you: { creaturesCount: 1, creatureSubtypes: ['Human'] },
  },
  ...keywordScenarios(torgalAFineHound),
];
