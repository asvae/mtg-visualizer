import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  // No PlayerState field seeds a plain (non-artifact) library card typed
  // Creature — `libraryArtifactCount` is the only typed-library-card option
  // harness.ts exposes (see this file's own module comment) — so only the
  // Artifact-typed match and the genuine non-match/empty cases are
  // exercisable here.
  { result: 'reveals the artifact and puts it into hand, creates a Food token', trigger: 'onUpkeep', you: { libraryCount: 1, libraryArtifactCount: 1 } },
  { result: 'top card is neither artifact nor creature, no-op', trigger: 'onUpkeep', you: { libraryCount: 1 } },
  { result: 'empty library, no-op', trigger: 'onUpkeep', you: { libraryCount: 0 } },
  { result: 'sacrifices an artifact, puts a +1/+1 counter on each creature you control', face: 'back', you: { creaturesCount: 2, artifactsCount: 1 } },
];
