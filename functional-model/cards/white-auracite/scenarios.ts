import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: "exiles a nonland permanent the opponent controls", trigger: 'onEnter', opponents: [{ creaturesCount: 1 }] },
  { result: 'no nonland permanent for the opponent to lose, nothing exiled', trigger: 'onEnter', opponents: [{ landsCount: 2 }] },
];
