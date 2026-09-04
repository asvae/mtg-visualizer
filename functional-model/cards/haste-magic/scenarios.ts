import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'target creature gets +3/+1 and gains haste until end of turn; exiles the top library card', castFrom: 'hand', you: { creaturesCount: 1, libraryCount: 1 } },
  { result: 'no legal target, nothing pumped; the library is empty so nothing is exiled', castFrom: 'hand', you: { creaturesCount: 0, libraryCount: 0 } },
];
