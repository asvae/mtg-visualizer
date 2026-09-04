import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'enters tapped', trigger: 'onEnter' },
  { result: 'returns from the graveyard to hand (the {B} payment is not a resolvable state here)', trigger: 'onNoncreatureSpellCast' },
];
