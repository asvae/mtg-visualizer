import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  {
    result: 'gains control of the target creature, untaps it and grants it haste, and attaches your Equipment to it',
    castFrom: 'hand',
    opponents: [{ creaturesCount: 1 }],
    you: { equipmentCount: 1 },
  },
  {
    result: 'gains control of the target creature and grants it haste (no Equipment you control to attach)',
    castFrom: 'hand',
    opponents: [{ creaturesCount: 1 }],
  },
];
