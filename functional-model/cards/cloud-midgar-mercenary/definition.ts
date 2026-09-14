import type { CardDefinition, Effect, AuthoredFact } from '../../card';

export const cloudMidgarMercenary: CardDefinition = {
  name: 'Cloud, Midgar Mercenary',
  manaCost: '{W}{W}',
  typeLine: 'Legendary Creature — Human Soldier Mercenary',

  // Real "Panharmonicon effect" (ENGINE_GAPS.md gap #13, closed
  // 2026-09-12) — "As long as Cloud is equipped, if a triggered ability of
  // Cloud or an Equipment attached to it triggers, that ability triggers an
  // additional time." (real Scryfall oracle text, data/fin/
  // fin_scryfall.json — matches, not the slightly older cardsfolder script
  // wording "an ability" vs "a triggered ability"; also fixed a pre-existing
  // "this"-for-"Cloud" misquote in this comment while adding the annotation
  // below). No `causedBy`
  // restriction at all — ANY triggered ability of Cloud himself OR of
  // whatever's attached to him doubles, gated purely on "genuinely equipped
  // right now" (`state.ts`'s own `shouldDoubleTrigger`/`triggerDoublingGrantApplies`).
  // Own annotation: `definition-annotations.json`, keyed
  // `"triggerDoubling[0]"` — the static grant's own real, standalone
  // printed line, separate from the onEnter search trigger below.
  triggerDoubling: [
    {
      scope: 'selfAndAttachedEquipment',
    },
  ],

  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
      // Real search targets Equipment specifically; this model's `move`
      // validType union only distinguishes creature/artifact/any (no
      // Equipment subtype tracking on generic library cards — see
      // state.ts's RealCard), so 'artifact' is the closest honest match,
      // not a claim this is subtype-precise.
      effects: [{ kind: 'move', owner: 'you', from: 'Library', to: 'Hand', qty: 1, validType: 'artifact' } satisfies Effect],
    },
  ],
  // Tier 3 (`CardDefinition.authoredFacts`). This card's `onEnter` trigger
  // DOES set the closed, typed `Trigger.on: 'enter'` field — but that alone
  // is NOT a safe general rule for deriving this sink: `ambrosia-whiteheart`'s
  // own `onEnter` trigger (this same 10-card sample) ALSO sets `on: 'enter'`
  // and has NO equivalent sink in its real, hand-authored `synergy.json` — a
  // genuine, confirmed inconsistency this trial surfaced, not a rule this
  // recognizer approach can safely generalize from without risking a false
  // positive on Ambrosia. Authored per-card instead, matching this card's own
  // real `synergy.json` sink fact byte-for-byte. Not wired into
  // `apply-recognizers.mjs`/`synergy.json` generation. Own annotation:
  // `definition-annotations.json`, keyed `"authoredFacts[0]"`.
  authoredFacts: [
    {
      role: 'sink',
      event: 'entersBattlefield',
      target: 'self',
      value: 1,
    },
  ] satisfies AuthoredFact[],
};
