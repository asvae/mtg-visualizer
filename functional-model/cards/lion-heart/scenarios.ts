import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'deals 2 damage to a creature (preferred over a player, same deterministic any-target convention every dealDamageAnyTarget card uses)', trigger: 'onEnter', opponents: [{ creaturesCount: 1 }] },
  { result: 'deals 2 damage to a player (no creature on the battlefield to prefer)', trigger: 'onEnter' },
  { result: 'attaches to the target creature you control', you: { creaturesCount: 1 } },
];
