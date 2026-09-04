import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'finds the artifact and puts it into hand', trigger: 'onEnter', you: { libraryArtifactCount: 1, libraryCount: 3 } },
  { result: 'no artifact in library or graveyard, nothing found', trigger: 'onEnter', you: { libraryCount: 2 } },
];
