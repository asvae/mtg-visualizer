import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  // Single scenario per the standing "default 1, demonstrate the real basic
  // function" rule (SYNERGY_DESIGN.md) — this is one condition-scaled pump
  // effect, not a branching modal, so the 3+ creatures / +4/+4 board state
  // is shown (the more complete real number), not a second scenario for the
  // baseline +2/+2 case.
  { result: 'you control 3+ creatures: target creature gets +4/+4 until end of turn instead', castFrom: 'hand', you: { creaturesCount: 3 } },
];
