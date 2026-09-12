import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { valkyrieAerialUnit } from './definition';

export const scenarios: Scenario[] = [
  // No top-level `trigger` (2026-09-12, migration to the unified Fact
  // model) — same consolidation cloudbound-moogle/rook-turret/dwarven-
  // castle-guard already established: harness.ts's own `selfZone` rule
  // starts this card on the Stack and runs the real cast->resolve->enters
  // lifecycle first (real fn:'cast'/fn:'enters' evidence for the baseline
  // self-cast/self-enters facts, previously undemonstrated when this
  // scenario set a top-level `trigger` directly), then `sequence` fires
  // `onEnter` right after, against the same shared GameState.
  { result: 'is cast from hand, enters the battlefield, then surveils 2', sequence: ['onEnter'] },
  ...keywordScenarios(valkyrieAerialUnit),
];
