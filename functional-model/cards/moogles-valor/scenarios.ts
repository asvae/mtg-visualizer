import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'creates 3 Moogle tokens; all creatures you control (Grizzly Bears x3 and the new Moogles) gain indestructible', castFrom: 'hand', you: { creaturesCount: 3 } },
  { result: 'creates no tokens — no creatures to count; grant still fires with no creatures to affect', castFrom: 'hand', you: { creaturesCount: 0 } },
];
