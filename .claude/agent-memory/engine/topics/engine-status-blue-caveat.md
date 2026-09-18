# Features dashboard `blue` ≠ "real gameplay-scenario verified"

`engine-status.ts`'s `blue` classification (Features tab) means "cites
>=1 `*.test.ts` file per a regex, no named remainder" — this is a
materially weaker bar than "backed by a real, checked-in
`trace.json`-equivalent scenario," and the two get conflated easily
because that IS the bar on other axes (Cards' `scenarios.ts`/
`trace.json`, the sink-derivation predicate corpus's own `blue`).

A 2026-09-18 audit found real gaps between the two: several `blue` gaps
were backed only by a narrow single-function unit test with zero
`createEngine`/turn-structure piloting; one gap's citation was a
`TEST_CITATION_RE` false-positive (matched a filename mentioned in prose
saying that file did NOT need touching, not an actual citation) for a
file (`card.test.ts`) that doesn't exist anywhere in the repo; another
cited a synergy-fact recognizer test that never touches `GameState` at
all — a real domain mismatch, not engine-runtime evidence.

A same-day follow-up added real `engine.test.ts` describe blocks (real
`CardDefinition` imports, real `castSpell`/`declareAttackers`/`advance()`
piloting — not synthetic fixtures) for the 11 gaps the user had flagged
via the review-reject overlay, closing the gap for those 11 specifically.
**The general caveat still holds** for any gap that reaches `blue` in the
future purely via the citation regex without a genuine
`createEngine`-driven describe block — don't assume `blue` alone means
scenario-equivalent evidence; check what the cited test file actually
does before treating a `blue` gap as fully proven.
