import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  {
    result: 'the chosen creature (power 3) deals 3 damage to each of the 2 other creatures; not cast from graveyard, no discard/draw',
    castFrom: 'hand',
    you: { creaturesCount: 1, creaturePower: 3 },
    opponents: [{ creaturesCount: 2 }],
  },
  {
    result: 'cast from the graveyard via Flashback: the chosen creature still deals damage equal to its power, then discards the whole hand and draws four cards',
    castFrom: 'graveyard',
    you: { creaturesCount: 1, creaturePower: 2, handCount: 3 },
    opponents: [{ creaturesCount: 1 }],
  },
];
