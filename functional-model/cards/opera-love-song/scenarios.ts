import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'exiles the top two cards of your library', castFrom: 'hand', mode: 0, you: { libraryCount: 4 } },
  { result: 'pumps two target creatures +2/+0 until end of turn', castFrom: 'hand', mode: 1, you: { creaturesCount: 1 }, opponents: [{ creaturesCount: 1 }] },
  { result: 'only one legal creature on the battlefield: pumps just that one +2/+0', castFrom: 'hand', mode: 1, you: { creaturesCount: 1 } },
];
