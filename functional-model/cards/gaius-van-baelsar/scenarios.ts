import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  {
    label: 'ETB, mode 0 (sac creature token)',
    trigger: 'onEnter',
    mode: 0,
    you: { creaturesCount: 2, nontokenCreaturesCount: 1 },
    opponents: [{ creaturesCount: 2, nontokenCreaturesCount: 1 }],
  },
  {
    label: 'ETB, mode 1 (sac nontoken creature)',
    trigger: 'onEnter',
    mode: 1,
    you: { creaturesCount: 2, nontokenCreaturesCount: 1 },
    opponents: [{ creaturesCount: 2, nontokenCreaturesCount: 1 }],
  },
  {
    label: 'ETB, mode 2 (sac enchantment)',
    trigger: 'onEnter',
    mode: 2,
    you: { enchantmentsCount: 1 },
    opponents: [{ enchantmentsCount: 1 }],
  },
];
