import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  // No resolvable effects/triggers/keywords/ptFormula — every real ability
  // is a continuous static permission (see definition.ts's own comment), so
  // there's nothing for `keywordScenarios` to probe either. One baseline
  // cast scenario documents that, same as hill-gigas' own first scenario.
  { result: 'enters the battlefield with no resolvable effect — all three abilities are continuous static permissions (see definition.ts)' },
];
