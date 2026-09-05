import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  {
    result: 'sacrifices a legendary creature (additional cost) as this counters a target ability or noncreature spell',
    castFrom: 'hand',
    mode: 0,
    you: { creaturesCount: 1, creatureSubtypes: ['Legendary'] },
  },
  { result: 'pays {2} instead of sacrificing, then counters a target ability or noncreature spell', castFrom: 'hand', mode: 1 },
];
