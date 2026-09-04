import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  {
    castFrom: 'hand',
    you: { creaturesCount: 1 },
    opponents: [{ equipmentCount: 1 }],
    result: "gains control of the opponent's Equipment until end of turn and attaches it to your creature",
  },
];
