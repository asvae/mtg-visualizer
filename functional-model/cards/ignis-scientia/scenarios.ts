import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { ignisScientia } from './definition';

export const scenarios: Scenario[] = [
  {
    result: 'searches for a land and puts it onto the battlefield (no land-typed library filler exists in this model to actually match, see definition.ts)',
    trigger: 'onEnter',
    you: { libraryCount: 1 },
  },
  {
    // No PlayerState field seeds a non-creature graveyard filler (only
    // `graveyardCreatureCount`, always Creature-typed) — only the
    // creature-exiled branch is exercisable here.
    result: 'exiles the creature card from your graveyard and creates a Food token',
    you: { graveyardCreatureCount: 1 },
  },
  ...keywordScenarios(ignisScientia),
];
