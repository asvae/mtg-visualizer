import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'surveils 2, you gain 2 life; not cast from graveyard, no transform', castFrom: 'hand', you: { libraryCount: 2 } },
  {
    result: 'cast from the graveyard via Flashback: surveils 2, gains 2 life, exiles itself and returns to the battlefield transformed with a finality counter (final tracked zone is Exile — see definition.ts comment)',
    castFrom: 'graveyard',
    you: { libraryCount: 2 },
  },
  { result: 'chapter I: reveals the top library card and puts it into hand (validType is over-broad "any" here — see definition.ts comment)', face: 'back', trigger: 'chapterI', you: { libraryCount: 1 } },
  { result: 'chapter II: adds {G}{G} (not modeled — no mana-production Effect kind exists)', face: 'back', trigger: 'chapterII' },
  {
    result: 'chapter III: other creatures you control get +2/+2 and gain trample until end of turn',
    face: 'back',
    trigger: 'chapterIII',
    you: { creaturesCount: 2 },
  },
];
