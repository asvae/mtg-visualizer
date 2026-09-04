import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'draws two cards', castFrom: 'hand' },
  { result: 'draws two cards (cast via Flashback, then exiled instead of returning to the graveyard)', castFrom: 'graveyard' },
];
