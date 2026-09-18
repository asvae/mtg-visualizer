# Multi-face / DFC data gotchas

- **Scryfall never serves per-face `keywords`** — a transform DFC's
  `card_faces[i].keywords` is always `undefined`/absent; only the
  whole-card top-level `card.keywords` exists, and that's already the
  UNION of both faces' keywords. Confirmed live against every FIN
  transform DFC (~26 cards). To badge only the currently-shown face's own
  real printed keyword, you must scan that face's own `oracle_text` for a
  standalone keyword line yourself (`app/lib/buildGraph.ts`'s
  `cardFaceKeywords(card, face)` does this — restricted to keywords
  `card.keywords` already confirms the card has somewhere, so a face can
  never pick up a bare word mentioned only in flavor/reminder prose). A
  face merely *mentioning* a keyword inside a continuous-grant sentence
  ("...and other Knights you control have flying") is NOT the same as
  printing it as a bare keyword line — don't conflate the two mechanisms.
- **A DFC's `PoolCard.name` (from `CardDefinition.name`) is the FRONT
  face's name ALONE**, never the combined `"Front // Back"` string —
  that combined form only exists as Scryfall's own top-level `name` field.
  Any code resolving a plain card name into the functional-model pool (a
  decklist line, a by-name lookup) must account for this or every DFC
  silently fails to resolve.
- `buildGraph.ts`'s own separate whole-graph node builder deliberately
  keeps the OLD whole-card keyword union for its own `CardData` — a graph
  node badge means "has this ability somewhere on the card," a different,
  intentionally coarser question than "on the currently-displayed face."
  Don't try to unify these two `CardData` keyword semantics.
- **FIN reuses collector numbers 300+/400+/500+** for booster-fun/
  showcase/extended-art/surgefoil re-treatments of the SAME card (e.g.
  Aerith Gainsborough: #4 base, plus #374/#423/#519 bonus variants,
  identical name/oracle text). "Mechanically unique" in this codebase
  means Scryfall's own `unique=cards` one-printing-per-name collapse — the
  same convention `server/api/cards.ts`/`cards/by-names.ts`/the card
  route's own `fetchStandardPrintForName` already rely on. Any
  "walk to the next/previous card" feature must resolve a bonus number to
  its own true position via the real card's name, not treat collector
  numbers as a plain numeric sequence, or neighbors land on nearest-number
  strangers instead of the actual base/bonus siblings
  (`server/api/cards/set-order/[set].ts`'s `representativeByNumber` map is
  the fix for this — anchor on it before indexing into the deduped list).
