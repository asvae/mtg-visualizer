import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: "Gungnir — destroys target creature an opponent controls", trigger: 'chapterI', opponents: [{ creaturesCount: 1 }] },
  {
    result: 'Zantetsuken — no resolvable effect in this model (grant-a-new-ability and loses-the-game are both missing Effect kinds — see this batch\'s final report)',
    trigger: 'chapterII',
  },
  { result: 'Hall of Sorrow — draw two cards, each player loses 2 life', trigger: 'chapterIII', opponents: [{}] },
];
