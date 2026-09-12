import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { rookTurret } from './definition';

export const scenarios: Scenario[] = [
  // No top-level `trigger` (2026-09-12, migration to the unified Fact
  // model) — same consolidation `dwarven-castle-guard`/`cloudbound-moogle`
  // already established: `harness.ts`'s own `selfZone` rule starts this
  // card on the Stack and runs the REAL cast->resolve->enters lifecycle
  // first (real `fn:'cast'`/`fn:'enters'` evidence for the baseline
  // `self-cast`/`self-enters` facts, previously undemonstrated when this
  // scenario set a top-level `trigger` directly), then `sequence` fires
  // `onArtifactEnters` AFTER that lifecycle, against the same shared
  // GameState — one real scenario, no evidence tradeoff.
  { result: 'is cast from hand, enters the battlefield; another artifact you control then enters, so it draws a card, then discards a card', you: { handCount: 2 }, sequence: ['onArtifactEnters'] },
  ...keywordScenarios(rookTurret),
];
