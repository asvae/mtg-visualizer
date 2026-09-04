import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  // `PlayerState` has no field to seed a library with a typed Land (let
  // alone a Town-subtyped Land) — only `libraryArtifactCount` exists for a
  // typed library card (added for Ashe's own artifact dig). The 4 milled
  // cards here are generic (no type), so no land is ever among them — this
  // is a real, honest outcome for that setup (no land milled -> no move, no
  // life gain), not a placeholder; the "found a Town" branch is correctly
  // authored (see definition.ts) but not scenario-testable given this gap.
  { result: 'mills 4 cards; no land among them, so nothing moves to hand and no life is gained', trigger: 'onEnter', you: { libraryCount: 4 } },
];
