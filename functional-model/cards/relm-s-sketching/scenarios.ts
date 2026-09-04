import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { castFrom: 'hand', you: { creaturesCount: 1, creaturePower: 4 }, result: 'creates a token copy of the target creature (same power/toughness/name)' },
  { castFrom: 'hand', opponents: [{ artifactsCount: 1 }], result: "creates a token copy of the opponent's target artifact" },
  { castFrom: 'hand', you: { landsCount: 1 }, result: "creates a token copy of the target land" },
];
