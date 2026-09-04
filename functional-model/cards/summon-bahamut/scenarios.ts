import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'destroys a nonland permanent', trigger: 'chapterI', opponents: [{ artifactsCount: 1 }] },
  { result: 'destroys a nonland permanent', trigger: 'chapterII', opponents: [{ artifactsCount: 1 }] },
  { result: 'draws two cards', trigger: 'chapterIII' },
  { result: 'deals 7 damage to each opponent', trigger: 'chapterIV', triggerInput: { totalManaValue: 7 }, opponents: [{ life: 20 }] },
];
