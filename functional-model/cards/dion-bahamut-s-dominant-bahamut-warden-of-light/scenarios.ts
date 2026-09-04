import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'creates a 2/2 white Knight creature token', trigger: 'onEnter' },
  { result: "exiles Dion and returns it transformed into Bahamut, Warden of Light" },
  { result: 'puts a +1/+1 counter on each of the other two creatures it controls', face: 'back', trigger: 'chapterI', you: { creaturesCount: 2 } },
  { result: 'puts a +1/+1 counter on each of the other two creatures it controls', face: 'back', trigger: 'chapterII', you: { creaturesCount: 2 } },
  {
    // Real script's own `ValidTgts$ Permanent` has no controller
    // restriction — "destroy target permanent," not "an opponent
    // controls" — so an opponent's creature being available doesn't change
    // which candidate `chooseTarget` (always-first-pool-candidate) picks;
    // `playersFor('each', ...)` orders `[you, ...opponents]`, and Bahamut
    // itself is the only permanent set up for its own controller, so it's
    // still the first (and here, only observed) candidate. Confirmed NOT a
    // card-text bug — see definition.ts's own comment.
    result:
      "destroys itself (the only permanent set up for its own controller, and so still the first candidate the destroy pool offers, even with an opponent's creature also on the battlefield), then exiles and returns transformed back into Dion, Bahamut's Dominant",
    face: 'back',
    trigger: 'chapterIII',
    opponents: [{ creaturesCount: 1 }],
  },
];
