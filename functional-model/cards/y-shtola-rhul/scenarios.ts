import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { yshtolaRhul } from './definition';

export const scenarios: Scenario[] = [
  {
    // ENGINE_GAPS.md gap #17 (closed 2026-09-12): the FIRST end step of the
    // turn genuinely queues an additional end step now (`turn.ts`'s own
    // `queueExtraPhase`) — `firstPhaseGroupOccurrenceThisTurn: true` is the
    // same real, caller-supplied fact `engine.ts`'s own
    // `fireOnPhaseEnterTriggers` sets when this fires through the real
    // engine (`card.ts`'s `EffectContext.firstPhaseGroupOccurrenceThisTurn`).
    result: 'exiles itself (the first pool candidate) and returns it to the battlefield; being the first end step of the turn, an additional end step is queued',
    trigger: 'onEndStep',
    firstPhaseGroupOccurrenceThisTurn: true,
  },
  {
    result: 'exiles the other (nontoken) creature it controls and returns it to the battlefield',
    trigger: 'onEndStep',
    you: { creaturesCount: 1, nontokenCreaturesCount: 1 },
    firstPhaseGroupOccurrenceThisTurn: true,
  },
  {
    // A generated filler TOKEN creature really does cease to exist once
    // exiled (real rule 111.7 — see this card's own `definition.ts` comment),
    // so the second `moveTo` back to the battlefield is correctly skipped.
    result: 'exiles the other (token) creature it controls; it ceases to exist and does not return',
    trigger: 'onEndStep',
    you: { creaturesCount: 1 },
    firstPhaseGroupOccurrenceThisTurn: true,
  },
  {
    // The real negative case (ENGINE_GAPS.md gap #17): a LATER end step this
    // same turn (the one this card's own additional-end-step trigger just
    // produced, e.g.) does NOT queue yet another one — real Forge's own
    // `Count$FinishedEndOfTurnsThisTurn`/`ConditionSVarCompare$ LT1` gate,
    // preventing an infinite chain of end steps.
    result: 'exiles itself and returns it to the battlefield; a later end step this turn does not queue another one',
    trigger: 'onEndStep',
    firstPhaseGroupOccurrenceThisTurn: false,
  },
  ...keywordScenarios(yshtolaRhul),
];
