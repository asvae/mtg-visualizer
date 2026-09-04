import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: "returns the opponent's nonland permanent to hand", trigger: 'onEnter', opponents: [{ creaturesCount: 1 }] },
  { result: 'no other nonland permanent to target; nothing returned (optional)', trigger: 'onEnter', opponents: [{}] },
  { result: 'exiles Jill and returns it transformed into Shiva, Warden of Ice' },
  { result: 'Mesmerize resolves — no trackable mutation in this model (evasion grant is untracked)', face: 'back', trigger: 'chapterI' },
  { result: 'Mesmerize resolves — no trackable mutation in this model (evasion grant is untracked)', face: 'back', trigger: 'chapterII' },
  {
    result: "exiles Shiva and returns it to the battlefield front-face-up (tapping opponents' lands is not modeled — no tapAll Effect kind exists yet)",
    face: 'back',
    trigger: 'chapterIII',
    opponents: [{ landsCount: 2 }],
  },
];
