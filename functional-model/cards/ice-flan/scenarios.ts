import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: "taps the opponent's target creature and puts a stun counter on it", trigger: 'onEnter', opponents: [{ creaturesCount: 1 }] },
  { result: 'no legal target — the opponent controls no creatures, nothing tapped or countered', trigger: 'onEnter', opponents: [{ creaturesCount: 0 }] },
  {
    result: "with a creature on both sides, still taps only the opponent's — self's own controller isn't a legal target",
    trigger: 'onEnter',
    you: { creaturesCount: 1 },
    opponents: [{ creaturesCount: 1 }],
  },
];
