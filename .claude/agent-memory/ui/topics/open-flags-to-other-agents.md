# Open cross-lane flags raised by `ui`, not yet confirmed resolved

Check currency before repeating these (dates given) — they may have been
picked up by the other lane since.

- **`card` lane**: `CardDetailTabs.vue`'s Confirm / "Confirm (Uncertain)"
  buttons (NOT Unconfirm — that one's never gated) render regardless of
  `cardStatus`'s baseline. `card-schema.md` itself already documents this
  as an intended-but-not-yet-done gate. Should be gated behind
  `cardStatusBaseline(cardStatus.status) === 'blue'`, matching the same
  policy already applied on Predicates/Features (`ui`'s own pages). Flagged
  2026-09-18; belongs to `card` since the component lives in their lane.
- **`card` lane**: `released_at` is stripped before the client ever sees
  it on every route except the local FIN bulk-pool path (`_cardShaping.ts`
  `minimalCard()`, `server/api/cards.ts`, `server/api/card/[set]/
  [number].ts`, `server/api/cards/by-names.ts` all omit it). SearchBox's
  "Newest first" sort therefore can't actually reorder live-discovered
  results by release date — the one case it was built for. Needs
  `released_at` threaded through those routes' response shapes. Flagged
  2026-09-16; see `search-box-design.md` for the feature this blocks.
