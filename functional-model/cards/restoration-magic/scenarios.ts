import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'chooses a permanent to target (hexproof/indestructible grant not mechanically enforced)', mode: 0, you: { creaturesCount: 1 } },
  { result: 'no legal permanent target, no-op', mode: 0 },
  { result: 'chooses a permanent to target and gains 3 life (hexproof/indestructible grant not mechanically enforced)', mode: 1, you: { creaturesCount: 1 } },
  { result: 'gains 6 life (hexproof/indestructible grant not mechanically enforced)', mode: 2, you: { creaturesCount: 2, artifactsCount: 1 } },
];
