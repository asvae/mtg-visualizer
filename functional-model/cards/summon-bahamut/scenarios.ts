import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  // Common line: real 714.3a/b Saga chapters fire in order against the same
  // board state (harness.ts's own `sequence` — real lore-counter/turn timing
  // still isn't simulated, just "these triggers really do all happen, in
  // this order, over the game"). Chapters I/II's own "up to one target
  // nonland permanent" is genuinely optional (real TargetMin$0) — self is
  // unavoidably the first candidate in the unrestricted pool this engine
  // would otherwise deterministically pick (no player-decision engine
  // exists, see card.ts's own `chooseTarget`), so both decline here
  // (`declineTriggers`, harness.ts's own real `EffectContext.declineOptional`)
  // rather than the card blowing itself up — the actual sane line, not an
  // edge case. Opponent still has an artifact on board specifically to show
  // this is a genuine decline (a legal target existed and wasn't taken),
  // not merely "nothing to hit."
  {
    result: 'chapters I and II both decline their optional destroy (a legal target exists on the opponent side, but this line chooses not to spend it there or on itself), III draws two cards, IV deals damage equal to other permanents’ total mana value, then Bahamut is sacrificed',
    sequence: ['chapterI', 'chapterII', 'chapterIII', 'chapterIV'],
    declineTriggers: ['chapterI', 'chapterII'],
    sacrificeSelfAfter: true,
    triggerInput: { totalManaValue: 7 },
    opponents: [{ artifactsCount: 1, life: 20 }],
  },
  // Minimal proof that "destroy" is a real, exercised capability, not just
  // declared — without at least one scenario actually calling it,
  // verify-synergy.mjs would hard-fail the destroy-nonland produce fact for
  // having no supporting trace line at all. Self is the only nonland
  // permanent on your side (real, unrestricted printed text has no owner
  // clause), so this legally, if unhelpfully, destroys Bahamut itself —
  // same self-targeting determinism Coeurl/Dion's own chapter III already
  // documents elsewhere. Not the common line (see the scenario above); this
  // one exists purely so the ability's real behavior has trace evidence.
  {
    result: 'chapter I’s own unrestricted "destroy up to one target nonland permanent" has no target other than Bahamut itself on your side, so it legally (if pointlessly) destroys itself — documenting the effect actually fires, not just declines',
    trigger: 'chapterI',
  },
];
