import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'puts a blight counter on target land', trigger: 'onAttack', opponents: [{ landsCount: 2 }] },
  { result: 'no legal land target, no-op', trigger: 'onAttack', opponents: [{ landsCount: 0 }] },
];
