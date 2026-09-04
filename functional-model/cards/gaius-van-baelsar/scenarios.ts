import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  {
    result: 'each player sacrifices a creature token',
    trigger: 'onEnter',
    mode: 0,
    you: { creaturesCount: 2, nontokenCreaturesCount: 1 },
    opponents: [{ creaturesCount: 2, nontokenCreaturesCount: 1 }],
  },
  {
    result: 'each player sacrifices a nontoken creature',
    trigger: 'onEnter',
    mode: 1,
    you: { creaturesCount: 2, nontokenCreaturesCount: 1 },
    opponents: [{ creaturesCount: 2, nontokenCreaturesCount: 1 }],
  },
  {
    result: 'each player sacrifices an enchantment',
    trigger: 'onEnter',
    mode: 2,
    you: { enchantmentsCount: 1 },
    opponents: [{ enchantmentsCount: 1 }],
  },
];
