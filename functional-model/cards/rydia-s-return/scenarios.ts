import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'both creatures you control get +3/+3 until end of turn', castFrom: 'hand', mode: 0, you: { creaturesCount: 2 } },
  { result: '2 permanent cards moved from graveyard to hand', castFrom: 'hand', mode: 1, you: { graveyardCreatureCount: 2 } },
  { result: '1 permanent card moved from graveyard to hand', castFrom: 'hand', mode: 1, you: { graveyardCreatureCount: 1 } },
  { result: 'nothing to return, no legal targets', castFrom: 'hand', mode: 1, you: { graveyardCreatureCount: 0 } },
];
