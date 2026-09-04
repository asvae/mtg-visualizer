import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { label: 'Jecht deals combat damage to a player', trigger: 'onDealsDamage', opponents: [{}] },
  { label: 'Braska chapter I', face: 'back', trigger: 'chapterI', opponents: [{ handCount: 3 }] },
  { label: 'Braska chapter III', face: 'back', trigger: 'chapterIII', opponents: [{ creaturesCount: 3 }] },
];
