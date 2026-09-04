import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'finds the artifact and puts it into hand', trigger: 'onEnter', you: { libraryCount: 10, libraryArtifactCount: 1 } },
  { result: 'no artifact in library, nothing found', trigger: 'onEnter', you: { libraryCount: 10 } },
];
