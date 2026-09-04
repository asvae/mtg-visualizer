import type { Scenario } from '../../harness';
import { summonGfCerberus } from './definition';

export const scenarios: Scenario[] = [
  { result: 'looks at the top card of your library, may put it into the graveyard', trigger: 'chapterI' },
  { result: 'no observable effect — no spell-copy mechanism exists in this engine', trigger: 'chapterII' },
  { result: 'no observable effect — no spell-copy mechanism exists in this engine', trigger: 'chapterIII' },
];
