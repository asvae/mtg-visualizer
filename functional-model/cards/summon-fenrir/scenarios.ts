import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  {
    result: 'no basic land found in library (this harness has no way to seed a land-typed library card — see definition.ts), nothing put onto the battlefield',
    trigger: 'chapterI',
    you: { libraryCount: 3 },
  },
  {
    result: 'no mechanism here creates a new triggered ability at runtime — no observable effect (real text: the next creature spell cast this turn would enter with an extra +1/+1 counter)',
    trigger: 'chapterII',
  },
  {
    // Self (this Saga creature, power 3) is always on the battlefield for a
    // trigger scenario and counts as one of "creatures you control" —
    // beats the opponent's power-2 creature on its own.
    result: 'your greatest power (self, 3) beats the greatest opposing power (2): draws a card',
    trigger: 'chapterIII',
    opponents: [{ creaturesCount: 1, creaturePower: 2 }],
  },
  { result: 'tied for greatest power (self, 3, vs. 3): draws a card', trigger: 'chapterIII', opponents: [{ creaturesCount: 1, creaturePower: 3 }] },
  { result: "your greatest power (self, 3) is less than the opposing greatest power (5): no draw", trigger: 'chapterIII', opponents: [{ creaturesCount: 1, creaturePower: 5 }] },
];
