# Scryfall data-shape quirks that caused real bugs here

- **Split/adventure/flip multi-face cards' top-level `mana_cost`** is all
  faces' own `mana_cost` joined by `" // "` as ONE STRING (confirmed
  directly against the Scryfall API: split "Fire // Ice" ->
  `"{1}{R} // {1}{U}"`). `buildGraph.ts` must prefer `card_faces?.[0]?.
  mana_cost` FIRST and fall back to the top-level `mana_cost` only for a
  genuinely single-faced card (no `card_faces` at all) — the reverse
  priority renders every face's pips concatenated on one node. Transform/
  modal_dfc layouts (FIN's own DFCs) happen to leave the top-level field
  blank for that layout, which is why this bug hid for a while and only
  showed on split/adventure crossover-set cards.
- **Scryfall's `keywords` array only ever lists what a card itself HAS**,
  never what it merely grants/references on another permanent (e.g. Zack
  Fair, FIN: "Target creature you control gains indestructible" has an
  empty `keywords` array). `buildGraph.ts`'s `keywords` field therefore
  merges two sources: `cardKeywords()` (Scryfall's array) AND
  `keywordMentions()` (a whole-word regex scan of the card's own raw
  oracle text, all faces, against `BADGE_KEYWORDS`) — needed for the
  ability-icon badge strip on graph nodes to be complete.
- **A transform DFC's whole-card `keywords` union wrongly badges BOTH
  faces with a keyword only one face actually prints** (e.g. Crystal
  Fragments // Summon: Alexander: front-only Equip, back-only Flying, but
  the naive union lists all three). Any NEW consumer of a card's keywords
  for a specific face must use `cardFaceKeywords(card, faceIndex)`
  (`app/lib/buildGraph.ts`, shared with `card` lane's own per-card-page
  fix) — never the raw whole-card union — and remember it's front-face-
  only unless a `backKeywords` field is explicitly plumbed too.
