import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'finds the Vehicle (modeled as an artifact) and puts it into hand', you: { libraryArtifactCount: 1, libraryCount: 3 } },
  {
    result: 'finds the Vehicle (modeled as an artifact) and puts it directly onto the battlefield',
    castFrom: 'graveyard',
    you: { libraryArtifactCount: 1, libraryCount: 3 },
  },
];
