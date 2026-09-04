import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'puts a +1/+1 counter on itself', trigger: 'onExpensiveNoncreatureSpellCast' },
  { result: 'sacrifices itself, dealing 1 damage (its power) to the target creature', you: { creaturesCount: 1 } },
];
