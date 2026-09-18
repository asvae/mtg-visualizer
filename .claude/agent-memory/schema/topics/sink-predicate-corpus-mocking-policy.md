# Sink-derivation predicate corpora use mocked CardDefinitions (standing policy)

Confirmed standing policy (2026-09-18), scoped narrowly — do not
generalize it beyond its own axis:

- **Sink-derivation predicates** (`functional-model/sink-model/
  predicates/saga.ts`, `crew.ts`, and any future mechanism module) are
  pure functions of `CardDefinition` shape. Their own test corpora
  (`<mechanism>.test.ts` + `<mechanism>.corpus.json`) must use minimal,
  hand-constructed mocked `CardDefinition`s built from the same public
  combinator/builder functions real cards use (`combinator.ts`'s
  `sequence`/`branch`/`compare`, real `Effect` shapes) — never import a
  real card's own `definition.ts`. Real card names may still appear in
  test names/comments and in the corpus manifest's `mirrors` field as a
  readability anchor, never as the actual fixture (`.corpus.json` files
  use `case`+`mirrors`, not `card`/`slug`).
- **This does NOT apply to**: Features' `engine.test.ts` scenario
  describe blocks, or Cards' `scenarios.ts` — both of those keep this
  project's general "real cards only" rule
  (`feedback_scenario_replay_real_not_mocked` in the orchestrator's own
  memory). The distinction is the *kind* of thing under test: a
  predicate/matching-logic corpus proving structural pattern-matching
  vs. a scenario proving real gameplay.
- `sink-derivation-status.ts` only ever reads `total`/`passing` off a
  corpus manifest — renaming/reshaping its per-case fields (dropping
  `card`/`slug` for `case`/`mirrors`) needed zero changes there.
