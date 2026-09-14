import type { CardDefinition, Effect, AuthoredFact } from '../../card';

export const ambrosiaWhiteheart: CardDefinition = {
  name: 'Ambrosia Whiteheart',
  manaCost: '{1}{W}',
  typeLine: 'Legendary Creature — Bird',

  keywords: ['Flash'],

  triggers: [
    {
      // Real Forge: `OptionalDecider$ You` — the whole return is a "you
      // MAY," a real binary decline option, not just "up to one target"
      // (which the pool-exhaustion behavior of `move`'s targeted branch
      // already models for free when nothing else is in play). `optional`
      // is documentary only, like `sacrifice`'s own field — this model has
      // no player-decision engine, so a legal target still gets returned.
      name: 'onEnter',
      on: 'enter',
      effects: [{ kind: 'move', owner: 'you', from: 'Battlefield', to: 'Hand', qty: 1, target: true, notSelf: true, optional: true } satisfies Effect],
    },
    {
      // Landfall — real Forge fires this off ANOTHER permanent (a land)
      // entering, not this creature's own event. This model only dispatches
      // named triggers a scenario explicitly picks (no automatic "a land
      // entered" detection anywhere), so it's modeled the same way every
      // other trigger here is: a real, correctly-shaped effect, invoked
      // on cue rather than auto-detected.
      // Real "Landfall — Whenever a land you control enters, Ambrosia
      // Whiteheart gets +1/+0 until end of turn" — `untilEndOfTurn: true`
      // (2026-09-14) closes the real gap this used to have: a bare `pumpSelf`
      // was a PERMANENT `layers.add` entry with no expiry at all, even
      // though the printed text says otherwise (`state.ts`'s own `pump`/
      // `clearUntilEndOfTurnPumps` doc comments). See `scenarios.ts` for a
      // real engine-piloted demonstration spanning a full Cleanup.
      name: 'onLandfall',
      effects: [{ kind: 'pumpSelf', power: 1, toughness: 0, untilEndOfTurn: true } satisfies Effect],
    },
  ],
  // Tier 3 (`CardDefinition.authoredFacts`). Same "trigger's own firing
  // precondition, no single owning `Effect`" case as ashe-princess-of-
  // dalmasca's own `authoredFacts` (see that file's comment) —
  // 'onLandfall' is a free-text `name`, not one of `Trigger.on`'s closed
  // 'enter'/'upkeep'/'endStep' vocabulary. Matches this card's own real
  // `synergy.json` sink fact byte-for-byte. Not wired into
  // `apply-recognizers.mjs`/`synergy.json` generation. Own annotation:
  // `definition-annotations.json`, keyed `"authoredFacts[0]"`.
  authoredFacts: [
    {
      role: 'sink',
      event: 'landfall',
      controller: 'you',
      value: 1,
    },
  ] satisfies AuthoredFact[],
};
