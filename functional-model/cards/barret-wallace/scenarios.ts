import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { barretWallace } from './definition';

// No effects/triggers to exercise — the attack trigger's own damage amount
// can't be computed (see definition.ts's own comment: no isEquipped()/
// getAttachedTo() anywhere on Card) — so this is just the real lifecycle
// plus the shared keyword/legend-rule probes.
export const scenarios: Scenario[] = [
  { result: 'enters the battlefield, no other effect (attack trigger not modeled — see definition.ts comment)' },
  ...keywordScenarios(barretWallace),
];
