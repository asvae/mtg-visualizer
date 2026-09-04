import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'deals 4 damage to the tapped creature the opponent controls', trigger: 'chapterI', opponents: [{ creaturesCount: 1 }] },
  { result: 'no creature for the opponent to lose, nothing damaged', trigger: 'chapterI', opponents: [{}] },
  { result: 'another creature you control gets +1/+0 (flying grant not mechanically enforced)', trigger: 'chapterII', you: { creaturesCount: 2 } },
  { result: 'no other creature you control, no-op', trigger: 'chapterII', you: { creaturesCount: 0 } },
  { result: 'another creature you control gets +1/+0 (flying grant not mechanically enforced)', trigger: 'chapterIII', you: { creaturesCount: 2 } },
];
