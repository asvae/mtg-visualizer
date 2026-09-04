import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { lightningSecuritySergeant } from './definition';

export const scenarios: Scenario[] = [
  { result: 'exiles the top card of your library (the MayPlay permission is not modeled)', trigger: 'onDealsDamage', you: { libraryCount: 1 } },
  ...keywordScenarios(lightningSecuritySergeant),
];
