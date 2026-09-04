import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { ultimeciaTimeSorceress } from './definition';

export const scenarios: Scenario[] = [
  { result: 'surveils 2', trigger: 'onEnterOrAttacks' },
  {
    result: 'exiles 8 cards from the graveyard, then transforms into Ultimecia, Omnipotent (extra-turn text on the back face is a documented gap — no Effect kind exists for it)',
    trigger: 'onEndStep',
    you: { graveyardCreatureCount: 8 },
  },
  { result: 'back face: Menace only; the Time Compression extra-turn trigger has no representable Effect kind, see definition.ts', face: 'back' },
  ...keywordScenarios(ultimeciaTimeSorceress),
];
