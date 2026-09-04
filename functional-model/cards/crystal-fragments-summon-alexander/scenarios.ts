import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'exiles itself and returns transformed into Summon: Alexander' },
  { result: 'no resolvable effect in this model (damage prevention is not tracked here)', face: 'back', trigger: 'chapterI', you: { creaturesCount: 2 } },
  { result: 'no resolvable effect in this model (damage prevention is not tracked here)', face: 'back', trigger: 'chapterII', you: { creaturesCount: 2 } },
  { result: "taps both of the opponent's creatures", face: 'back', trigger: 'chapterIII', opponents: [{ creaturesCount: 2 }] },
];
