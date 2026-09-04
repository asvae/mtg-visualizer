import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  {
    result: 'puts the 2 Equipment cards from the library onto the battlefield and attaches one to Gilgamesh (a Samurai)',
    trigger: 'onEnter',
    you: { libraryArtifactCount: 2 },
  },
  {
    result: 'no Equipment among the library cards, nothing put onto the battlefield',
    trigger: 'onAttack',
    you: { libraryCount: 3 },
  },
];
