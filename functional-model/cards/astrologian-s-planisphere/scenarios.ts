import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'creates a 1/1 Hero token and attaches itself to it', trigger: 'onEnter' },
  { result: 'puts a +1/+1 counter on itself (granted trigger, modeled on this permanent)', trigger: 'onEquippedCastsNoncreatureSpell' },
  { result: 'puts a +1/+1 counter on itself (granted trigger, modeled on this permanent)', trigger: 'onEquippedDrawsThirdCardThisTurn' },
  { result: 'attaches to a creature you control', you: { creaturesCount: 2 } },
];
