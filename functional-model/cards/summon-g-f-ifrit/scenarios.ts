import type { Scenario } from '../../harness';
import { summonGfIfrit } from './definition';

export const scenarios: Scenario[] = [
  { result: 'discards a card, then draws a card', trigger: 'chapterI', you: { handCount: 1, libraryCount: 1 } },
  { result: 'discards a card, then draws a card', trigger: 'chapterII', you: { handCount: 1, libraryCount: 1 } },
  { result: 'no observable effect — no mana-production mechanism exists in this engine', trigger: 'chapterIII' },
  { result: 'no observable effect — no mana-production mechanism exists in this engine', trigger: 'chapterIV' },
];
