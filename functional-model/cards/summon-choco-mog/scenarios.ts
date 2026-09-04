import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'other creatures you control get +1/+0', trigger: 'chapterI', you: { creaturesCount: 2 } },
  { result: 'no other creatures to pump, no-op', trigger: 'chapterII', you: { creaturesCount: 0 } },
  { result: 'other creatures you control get +1/+0', trigger: 'chapterIII', you: { creaturesCount: 2 } },
  { result: 'other creatures you control get +1/+0', trigger: 'chapterIV', you: { creaturesCount: 2 } },
];
