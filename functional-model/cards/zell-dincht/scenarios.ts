import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'returns a land you control to your hand', trigger: 'onEndStep', you: { landsCount: 2 } },
  { result: 'no land to return, nothing happens', trigger: 'onEndStep', you: { landsCount: 0 } },
];
