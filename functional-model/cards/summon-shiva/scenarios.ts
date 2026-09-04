import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: "taps the opponent's target creature and puts a stun counter on it", trigger: 'chapterI', opponents: [{ creaturesCount: 1 }] },
  { result: "taps the opponent's target creature and puts a stun counter on it", trigger: 'chapterII', opponents: [{ creaturesCount: 1 }] },
  { result: 'no resolvable effect in this model (tapped-state isn\'t readable through Card here — see the gap noted in definition.ts)', trigger: 'chapterIII', opponents: [{ creaturesCount: 2 }] },
];
