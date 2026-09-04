import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'finds the artifact among the top 5 cards and puts it into hand', trigger: 'onAttack', you: { libraryCount: 8, libraryArtifactCount: 1 } },
  { result: 'no artifact among the top 5 cards, nothing taken', trigger: 'onAttack', you: { libraryCount: 8 } },
  { result: 'library empty, nothing to look at', trigger: 'onAttack', you: { libraryCount: 0 } },
];
