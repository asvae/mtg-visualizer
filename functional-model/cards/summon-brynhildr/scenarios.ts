import type { Scenario } from '../../harness';
import { summonBrynhildr } from './definition';

export const scenarios: Scenario[] = [
  { result: 'exiles the top card of your library (the "you may play it" permission is not modeled)', trigger: 'chapterI', you: { libraryCount: 2 } },
  { result: 'no observable effect — no delayed/future-cast-watching mechanism exists in this engine', trigger: 'chapterII' },
  { result: 'no observable effect — no delayed/future-cast-watching mechanism exists in this engine', trigger: 'chapterIII' },
];
