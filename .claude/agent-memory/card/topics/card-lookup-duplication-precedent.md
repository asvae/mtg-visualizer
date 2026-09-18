# Small per-route card-lookup duplication is deliberate, revisit at 4th consumer

Several `server/api/**` routes (`server/api/card/review-status.ts`,
`server/api/deck-sink-supply.post.ts`, and `server/api/card/[set]/
[number].ts`'s own `lookupCardBySetNumber`) each hand-roll their own small,
near-identical set/number → real-card lookup (local `data/cards.db` query
first, live Scryfall fallback second) instead of sharing one helper. This
is an established, deliberate precedent (`review-status.ts`'s own header
comment explains it: a shared helper would couple a route that only needs
the trivial single-field-read case to the big route's own token/
interaction/relations machinery), not an oversight to "fix" reflexively.

If a genuine 4th near-identical copy shows up, that's the point to
reconsider extracting a shared util — not before.
