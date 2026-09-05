import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  // One consolidated scenario covering the card's whole real arc against a
  // single shared board (harness.ts's own `sequence`, extended with step
  // objects for this card specifically: it transforms mid-arc, so later
  // steps need to say WHICH face they run against and whether they're a
  // trigger or the activated ability — see `SequenceStep`'s own doc
  // comment). Real lore-counter/turn timing between chapters still isn't
  // simulated, same accepted shortcut Summon: Bahamut's own `sequence`
  // already established.
  {
    result:
      "Jill enters, ETB returns the opponent's artifact (not their land — real text is nonland only) to hand; {3}{U}{U}, {T} exiles Jill and returns it transformed as Shiva, Warden of Ice; chapter I grants your creature unblockable; chapter II grants it again; chapter III taps all the opponent's lands, then exiles Shiva and returns it front-face-up",
    trigger: 'onEnter',
    you: { creaturesCount: 1 },
    opponents: [{ artifactsCount: 1, landsCount: 1 }],
    sequence: [{ activate: true }, { trigger: 'chapterI', face: 'back' }, { trigger: 'chapterII' }, { trigger: 'chapterIII' }],
  },
];
