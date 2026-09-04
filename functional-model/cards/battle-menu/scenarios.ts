import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'creates a 2/2 white Knight creature token', castFrom: 'hand', mode: 0 },
  { result: 'target creature gets +0/+4 until end of turn', castFrom: 'hand', mode: 1, you: { creaturesCount: 1 } },
  { result: 'destroys the power-4-or-greater creature', castFrom: 'hand', mode: 2, opponents: [{ creaturesCount: 1, creaturePower: 4 }] },
  { result: 'no legal target (power below 4), nothing destroyed', castFrom: 'hand', mode: 2, opponents: [{ creaturesCount: 1 }] },
  { result: 'you gain 4 life', castFrom: 'hand', mode: 3 },
];
