import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'enters the battlefield (additional cost/leaves-trigger not modeled — see definition.ts comment)' },
  { result: 'draws a card', trigger: 'onCastCreatureSpell' },
];
