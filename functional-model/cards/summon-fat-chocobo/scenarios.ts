import type { Scenario } from '../../harness';

// chapterIII/chapterIV are literal duplicates of chapterII (same real SVar
// repeated 3 times) — only chapterII is exercised, same "skip the identical
// duplicate" precedent jecht-reluctant-guardian-braska-s-final-aeon's own
// scenarios use (chapterII there is also an untested duplicate of chapterI).
export const scenarios: Scenario[] = [
  { result: "creates a 2/2 green Bird creature token (the token's own granted landfall pump ability is not modeled)", trigger: 'chapterI' },
  {
    result: 'creatures you control (itself, already on the battlefield, and the other creature) gain trample until end of turn',
    trigger: 'chapterII',
    you: { creaturesCount: 1 },
  },
];
