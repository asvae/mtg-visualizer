import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  {
    result: 'destroys your artifact and creature, and the opponent\'s creature; spares lands (end-the-turn clause not mechanically enforced)',
    castFrom: 'hand',
    you: { creaturesCount: 1, artifactsCount: 1, landsCount: 2 },
    opponents: [{ creaturesCount: 1, landsCount: 2 }],
  },
  { result: 'no artifacts or creatures anywhere, nothing destroyed', castFrom: 'hand', you: { landsCount: 2 }, opponents: [{ landsCount: 2 }] },
];
