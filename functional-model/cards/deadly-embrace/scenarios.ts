import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  {
    result: "destroys the opponent's creature, then draws 1 card (approximated as the graveyard's creature count at the moment of the read — see definition.ts comment on the untracked 'this turn' condition)",
    castFrom: 'hand',
    opponents: [{ creaturesCount: 1 }],
  },
  {
    result: 'destroys the creature, then draws 3 cards (the destroyed creature plus 2 already seeded in the graveyard)',
    castFrom: 'hand',
    opponents: [{ creaturesCount: 1 }],
    you: { graveyardCreatureCount: 2 },
  },
];
