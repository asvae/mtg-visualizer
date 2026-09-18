# Where the real engine design record lives

`notes.md` (this hub's predecessor, retired 2026-09-18) used to double as a
running engineering diary for the Fact-model rollout, the recognizer/
automated-authoring pipeline, and the sink-model/FDN experiment. Almost
none of that narrative needs to survive as memory: the substantive design
decisions it recorded are already written up, in more complete and
current form, in the project's own docs. Read those directly instead of
expecting this hub to re-derive or duplicate them:

- **`functional-model/ENGINE_DESIGN.md`** — engine architecture primer.
- **`functional-model/ENGINE_GAPS.md`** — the authoritative, actively
  maintained gap list (closed gaps use a `~~old~~` **CLOSED** strikethrough
  convention with real Forge citations; open gaps are prioritized). Any
  "real engine gap" observation belongs here, not in a memory topic.
- **`functional-model/SYNERGY_DESIGN.md`** — the Fact model's own design
  history (ZoneFact/EventFact unification, ACT-vs-CONSEQUENCE split,
  `targeted`/`untilEndOfTurn`/`recipient`/`colors` fields, the
  scenario-count-defaults-to-1 standing rule, the printed-Lifelink
  exception, `Fact.value` deprecation/removal, dated design corrections).
  If a card-migration judgment call feels novel, check here first — it
  has almost certainly already been decided and written up.
- **`functional-model/PRD_AUTOMATED_AUTHORING.md`** — the recognizer-library
  design doc (recognizer prototypes A-F+, `apply-recognizers.mjs` wiring,
  dedup/retag mechanics, decline taxonomy).
- **`.claude/contracts/card-schema.md`** — engine↔card boundary; also the
  home of record for the newer FDN/sink-model/pipeline-status axis (sink
  catalog, sink attachment, `pipeline-status.json`, the 6-color review
  axes). This is the most current source for anything sink-model-shaped.
- **`.claude/contracts/engine-status-schema.md`** /
  **`.claude/contracts/sink-derivation-status-schema.md`** — Features/
  Predicates dashboard shape, including the 6-color gray/purple/blue/
  yellow/green/re-review axis and its fingerprint-based drift detection.
- **`functional-model/CARD_DEFINITION_QUICKSTART.md`** /
  **`CARD_RESULTS_QUICKSTART.md`** — condensed onboarding refs (built for
  the 4-lane split: engine-core / recognizer / definition / card-results).
  Worth skimming for a fast vocabulary refresher; deliberately excludes
  SYNERGY_DESIGN.md/card-schema.md depth.
- **`functional-model/scripts/forge-lookup.mjs`** — given a card name,
  finds its real Forge script (`tmp/mtg-forge/.../cardsfolder/**/*.txt`)
  and, if present, its XMage class file. Use this instead of hand-grepping
  either checkout.

Only things NOT captured in the above (process/tooling gotchas, standing
policies that are more "how we work" than "what the engine does", and
genuinely still-open loose ends) belong in this hub's other topic files.
