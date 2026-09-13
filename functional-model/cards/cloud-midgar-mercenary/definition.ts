import type { CardDefinition, Effect } from '../../card';

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
  triggerDoubling: [
    {
      scope: 'selfAndAttachedEquipment',
      // PROTOTYPE (PRD_AUTOMATED_AUTHORING.md, fin/1-10 trial) — the static
      // grant's own real, standalone printed line (data/fin/
      // fin_scryfall.json), separate from the onEnter search trigger above.
      annotation: {
        highlight: 'As long as Cloud is equipped, if a triggered ability of Cloud or an Equipment attached to it triggers, that ability triggers an additional time.',
        line: 1,
      },
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
      // PROTOTYPE (PRD_AUTOMATED_AUTHORING.md, scoped trial).
      annotation: {
        highlight: 'When Cloud enters, search your library for an Equipment card, reveal it, put it into your hand, then shuffle.',
        line: 0,
      },
    },
  ],
};
