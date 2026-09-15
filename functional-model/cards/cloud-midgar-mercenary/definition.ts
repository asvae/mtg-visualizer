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
      // Real search targets Equipment specifically. `validType:'artifact'`
      // stays (Equipment cards ARE artifacts — CR 301.5c — so this is a
      // true, if broader, structural fact), now paired with `subtype:
      // 'Equipment'` (2026-09-15) for the precise real printed word.
      //
      // Mechanization pass (2026-09-14, closed for real 2026-09-15): this
      // effect's own `to:'Hand', from:'Library'` source/sink fact pair used
      // to stay hand-authored — the whole pool has a general "search
      // library, put into hand" template ("[You may ]search your library
      // for a[n] <type> card, reveal it, put it into your hand, then
      // shuffle" — `world-map`, `sazh-katzroy` both share it verbatim), but
      // every real candidate including THIS card had a confirmed divergence
      // between the structured `validType` field and the actual printed
      // type word (this card's own real text says "an EQUIPMENT card,"
      // never "artifact"). Closed by threading `move`'s own `subtype` field
      // (previously read only on the TARGETED branch — `card.ts`'s own
      // doc comment) through to the UNTARGETED branch too (`card.ts`'s
      // `case 'move'`, `interfaces.ts`'s `move` signature, `harness.ts`'s
      // `move` implementation, all updated the same pass) — the new
      // `recognizers/moveSearchLibrary-effect-structural.ts` now derives
      // this card's own source+sink pair for real (see that recognizer's
      // own module doc comment for the general rule, and for why Sazh
      // Katzroy/World Map still correctly, specifically decline — a
      // compound OR-restriction and a missing "Basic" supertype concept in
      // this engine, neither one this card's own gap).
      effects: [
        { kind: 'move', owner: 'you', from: 'Library', to: 'Hand', qty: 1, validType: 'artifact', subtype: 'Equipment' } satisfies Effect,
      ],
    },
  ],
  // Tier-3 `authoredFacts` sink (`{event:'entersBattlefield', target:'self'}`)
  // REMOVED 2026-09-15 — the earlier comment here worried that a bare
  // `on:'enter'` gate alone wasn't a safe general rule (Ambrosia Whiteheart's
  // own `onEnter` trigger also sets `on:'enter'` with no equivalent sink in
  // its own hand-authored data at the time). Resolved for real: the new
  // `recognizers/entersBattlefield-self-trigger-structural.ts` doesn't stop
  // at the bare `on:'enter'` gate — it ALSO requires a real, text-verified
  // "When/Whenever <self> enters" clause before asserting this sink, which
  // correctly derives it for THIS card (and for Ambrosia, once her own
  // trigger's real "When Ambrosia Whiteheart enters" clause is verified too
  // — see that recognizer's own module doc comment for the full, real
  // whole-pool check, 14 cards, only one genuine decline).
};
