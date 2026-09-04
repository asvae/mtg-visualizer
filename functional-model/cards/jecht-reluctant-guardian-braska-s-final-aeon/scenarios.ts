import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: "exiles Jecht and returns it transformed into Braska's Final Aeon", trigger: 'onDealsDamage', opponents: [{}] },
  { result: 'the opponent discards a card and you draw a card', face: 'back', trigger: 'chapterI', opponents: [{ handCount: 3 }] },
  { result: 'the opponent sacrifices two creatures', face: 'back', trigger: 'chapterIII', opponents: [{ creaturesCount: 3 }] },
];
