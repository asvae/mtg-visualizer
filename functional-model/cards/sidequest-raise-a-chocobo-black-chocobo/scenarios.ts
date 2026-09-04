import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'creates a 2/2 green Bird creature token', trigger: 'onEnter' },
  { result: 'the transform condition/consequence is text-only in this model — no board state is checked or mutated', trigger: 'onMainPhase' },
  {
    result:
      'no land card available in library to search for (this harness has no land-typed library filler — see definition.ts\'s own comment on this real, untestable gap)',
    face: 'back',
    trigger: 'onTransform',
    you: { libraryCount: 1 },
  },
  { result: 'itself plus the 2 other Birds you control (3 total) get +1/+0 until end of turn', face: 'back', trigger: 'onLandfall', you: { creaturesCount: 2, creatureSubtypes: ['Bird'] } },
  { result: 'the 2 other creatures are not Birds, so only itself (a Bird) gets +1/+0 until end of turn', face: 'back', trigger: 'onLandfall', you: { creaturesCount: 2 } },
];
