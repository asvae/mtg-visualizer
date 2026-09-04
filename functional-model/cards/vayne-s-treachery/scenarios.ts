import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'target creature gets -2/-2 until end of turn', castFrom: 'hand', mode: 0, opponents: [{ creaturesCount: 1 }] },
  {
    result: 'kicked: sacrifices an artifact or creature, target creature gets -6/-6 until end of turn instead',
    castFrom: 'hand',
    mode: 1,
    you: { artifactsCount: 1 },
    opponents: [{ creaturesCount: 1 }],
  },
];
