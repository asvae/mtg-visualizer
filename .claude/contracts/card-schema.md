# Contract: Engine ↔ Card boundary

Owner of source: **engine** agent. Owner of generated/served output:
**card** agent. If this file drifts from either side's real shape, whoever
noticed says so to the orchestrator — don't silently patch around a stale
contract.

## Per-card functional model (source, `engine` agent owns)

`functional-model/cards/<slug>/`:
- `definition.ts` — exports a `CardDefinition` (see
  `functional-model/card.ts`): `effects: Effect[]`, optional named
  `triggers`, `staticAbilities`, `modal` effect. Data-first — logic lives
  in `Effect` objects the shared `resolveCard()` interpreter dispatches on
  by `kind`, not per-card classes. A `Computed` function or `custom.run` is
  the only escape hatch and is opaque to synergy matching — narrow use only.
- `scenarios.ts` — exports `scenarios: Scenario[]` (see `harness.ts`), or
  `runEngineScenarios(): TraceResult[]` for the real-engine-piloted path
  (see `engine-trace.ts`).

## Generated output (card agent reads/presents, doesn't hand-author)

- `synergy.json` — from `functional-model/synergy.ts`'s
  `findInteractionsForCard`, source/sink facts.
- `trace.json` — `TraceResult[]`, see
  `.claude/contracts/state-event-format.md` for its shape.
- `progress.json` — review/tagging progress state.

## Served shape (card agent owns, `server/api/_cardShaping.ts`)

- `ScryfallCard` / `CardFace` / `ImageUris` interfaces in
  `server/api/_cardShaping.ts` — the live Scryfall-derived shape.
- `minimalCard()` — shrinks a `ScryfallCard` to what the graph/card UI
  actually reads.
- Card identity key across the whole app is **Scryfall name**, not
  `oracle_id` — confirmed 0 collisions across full history. Don't
  re-propose re-keying.

## Fact-to-oracle-text pointers (`annotations`) — 2026-09-11 rework, DONE (updated same day, see below)

`Fact.annotations: [AnnotationRef, ...AnnotationRef[]]` (`functional-model/
synergy.ts`) replaces the old live-recomputed `AnnotatedSegment[][]`
segment-tree design. Both engine and card sides are done for
summon-bahamut (fin/1) — scope was deliberately limited to that one card; a
pool-wide regen is a separate, later decision. `AnnotatedSegment`/
`AnnotatedFactRef`/`annotateOracleText` are confirmed unreferenced anywhere
under `app/`/`server/` and have been deleted outright from `synergy.ts`.

- **`AnnotationRef` shape — two variants**: `{ target: 'oracle', line:
  number, start: number, end: number }` (line 0-indexed within the OWNING
  FACE's own real `oracleText.split('\n')`, Scryfall's own paragraph
  breaks; `start`/`end` character offsets WITHIN THAT LINE ONLY, half-open
  — slice via `oracleText.split('\n')[line]!.slice(start, end)`), or (NEW,
  2026-09-11 later same day) `{ target: 'typeLine', start: number, end:
  number }` — offsets directly into the OWNING FACE's own real, single-line
  `typeLine` string (`CardDefinition.typeLine`/`.backFace.typeLine`) — no
  `line` field at all (a type line has no paragraph structure). Which face
  owns a fact is `Fact.face` (`'front'`/`'back'`/omitted = the only face on
  a single-faced card). The `typeLine` variant exists for a fact whose real
  textual basis genuinely isn't in the ability text at all — a baseline
  "this creature was cast as a creature spell" claim is true because of
  what's printed on the TYPE line, not the oracle-text body (Summon:
  Bahamut's own `self-cast`/`self-enters`).
- **`annotations` is REQUIRED, minimum one entry** (2026-09-11, later same
  day — was optional at first landing) — every fact must carry at least
  one real annotation; a fact with nothing real to anchor to doesn't
  belong in the model at all (fold or drop it, don't fake one). Enforced
  by `functional-model/scripts/annotation-coverage.mjs`
  (`ANNOTATED_CARD_SLUGS` allowlist — today just `summon-bahamut`), wired
  into `verify-synergy.mjs`'s exit code and a standalone
  `annotation-coverage.test.ts` (`npm run test`).
- **Computed ONCE, offline, and baked into `synergy.json`** —
  `functional-model/scripts/compute-annotations.mjs`, from each fact's own
  entry in a NEW, never-served, per-card `cards/<slug>/
  annotations-authoring.json` (`sourceText`/`highlight`/`anchor`,
  positionally aligned with that same card's `synergy.json` `source`/
  `sink` arrays — index-based, not id-keyed, since `Fact.id` is also gone)
  matched against the card's real Scryfall oracle text
  (`data/<set>/<set>_scryfall.json`) or real `typeLine` (straight off the
  already-imported `CardDefinition`, no extra data source). Never
  recomputed live server-side anymore. As of this writing only
  `cards/summon-bahamut/synergy.json`/`annotations-authoring.json` exist —
  a pool-wide regen is a separate, later decision.
- **`sourceText`/`highlight`/`anchor` are NOT on the served `Fact` shape at
  all anymore** (2026-09-11, later same day — they WERE directly on `Fact`
  at first landing; moved out once `annotations` itself became the
  required, real anchor, since the literal string is fully re-derivable by
  slicing `oracleText`/`typeLine` at the baked pointer — storing it twice
  was pure duplication). `curl localhost:3000/api/card/fin/1`'s
  `functionalModel.synergy` facts must NOT contain `sourceText`/`highlight`
  once `card` agent's own serving layer is updated to match (see the
  action items below) — only `annotations` + the real semantic fields
  (`role`, `event`/`zone`/`to`/`from`, `controller`, `subject`,
  `face`, constraints). **`value` is no longer one of them — see its own
  dated entry near the end of this file (2026-09-14): removed from the
  `Fact` type entirely, not merely deprecated.**
- **New `EventFact.zoneFrom`/`.zoneTo` fields** (2026-09-11, later same
  day; extended twice more the same day) — purely descriptive, spelling
  out the real zone movement a bare event tag otherwise leaves implicit.
  Standing rule: every real zone (Battlefield, Graveyard, Hand, Library,
  Exile, Command, ...) is a legitimate value when actually known; the
  Stack is the one deliberate exception, never assigned on either side
  (treated as invisible/skip-through — CR 601 casting moves a card
  THROUGH it, and no fact anywhere sinks on "is on the stack"). Today on
  this card: `self-dies`/`destroy-nonland` (`zoneFrom:'Battlefield'`,
  `zoneTo:'Graveyard'`, CR 700.4 — both ends fixed), `self-enters`
  (`zoneTo:'Battlefield'` only — origin varies/is-the-invisible-Stack),
  `self-cast` (`zoneFrom:'Hand'` only — destination IS the invisible
  Stack). Deliberately NOT named `from`/`to` (would misclassify as a
  `ZoneFact`) — NOT consulted by any matcher, purely informational.
  `card` agent: these WILL now appear on served facts for summon-bahamut;
  check `app/lib/factConditions.ts`'s `HANDLED_OR_LABEL_KEYS` (or
  equivalent Facts-table "what's already shown vs. what's an unhandled
  condition" allowlist) renders/ignores them sensibly rather than showing
  them as a mystery unhandled field.
- **New `EventFact.targeted?: boolean` field** (2026-09-11, later same day
  again) — purely descriptive, distinguishes a real CR 601.2c targeted
  choice ("destroy up to one target...", real hexproof/protection rules
  can matter) from an unconditional broadcast to everyone/everything a
  `target`/`recipient` bucket names ("...to each opponent", no choice).
  Only ever set (`true` or explicit `false`) when the fact's
  `target`/`recipient` names a real bucket of more-than-one possible
  candidate; omitted (not `false`) when the fact's only real subject is
  `'self'`/singular `you` (no bucket to have chosen among or broadcast to
  at all) — omission there means "not applicable," not "unreviewed." On
  this card: `destroy-act`/`destroy-nonland` → `true`; `chapter-iv-damage`
  → `false`; every other EventFact omits it. NOT consulted by
  `factsInteract`, NOT added to `themeOf` — purely informational, same
  category as `zoneFrom`/`zoneTo`. `card` agent: will appear on served
  facts for summon-bahamut; same allowlist check as `zoneFrom`/`zoneTo` —
  no rendering/exposure required yet, just don't let it show up as a
  mystery unhandled field.
- **SUPERSEDED same day, later still: `ZoneFact`/`EventFact` merged into
  ONE `Fact` interface** (user-approved architecture shift) —
  `zoneFrom`/`zoneTo` above are GONE, replaced by real `from`/`to`
  directly (a merged fact can now carry `event` and `to`/`from` at once,
  e.g. `{event:'dies', from:'Battlefield', to:'Graveyard', ...}`, ONE
  object where there used to be two). **The legacy `zone` field is also
  now folded into `to`** — `mega-flare-you` (the one sink fact on this
  card) changed from `zone:'Battlefield'` to `to:'Battlefield'`. `card`
  agent action items:
  - `app/lib/factConditions.ts`'s `HANDLED_OR_LABEL_KEYS` still lists
    `zoneFrom`/`zoneTo` — harmless (unused strings in a Set), but can be
    dropped in a future pass; `zone`/`to`/`from` are already in that same
    set, no new key needed for the rename itself.
  - `isZoneFact`/`isEventFact` (`functional-model/synergy.ts`) are no
    longer type-narrowing guards (`fact is ZoneFact`/`fact is EventFact`)
    — both are now plain `boolean`-returning classifiers, since
    `ZoneFact`/`EventFact` are themselves now just type ALIASES for
    `Fact` (kept only so this file's own `import type { ZoneFact }`
    keeps compiling unchanged — no edit needed here, but don't rely on
    either function narrowing a `Fact` to a narrower shape anymore, there
    isn't one).
  - A single fact can now satisfy BOTH `isZoneFact` and `isEventFact` at
    once (e.g. the merged `dies` fact above) — was structurally
    impossible before. If any card-side code assumed "never both,"
    check it (this file's own grep of `app/lib/factConditions.ts` found
    no such assumption — it already reads whichever fields are present,
    doesn't branch on exclusivity).
  - **Real interactions changed for this card** (documented in full,
    including a real before/after `find-synergies.mjs` diff, in
    `functional-model/SYNERGY_DESIGN.md`'s "Fact unification" section) —
    not a card-agent action item, just useful context if the Interactions
    panel for fin/1 looks different: `self-dies`/`destroy-nonland` no
    longer match the 11 real EventFact `event:'dies'` sinks pool-wide,
    `self-enters` no longer matches the 2 real EventFact
    `event:'entersBattlefield'` sinks — both now match real ZONE-shaped
    Graveyard/Battlefield-presence sinks instead. This is accepted,
    tracked, user-approved; not a bug to fix on the card side.
- **New `event:'pump'` vocabulary + new `Constraints.attacking?: boolean`
  field** (2026-09-11, later same day again) — `pump` is a deliberately
  GENERIC catch-all for a real P/T-boost effect (no amount/duration/
  permanence sub-fields), applied to 4 real fin/1-10 cards: Adelbert
  Steiner (self), Ambrosia Whiteheart (self), Auron's Inspiration (real
  `target: {types:{has:['Creature']}, attacking:true}` — "Attacking
  creatures get +2/+0," symmetric across both players, no controller
  restriction), Battle Menu (`target:{types:{has:['Creature']}}`,
  `targeted:true`). `describeFact` needed no new branch — its existing
  generic event fallback already renders `event:'pump'` as bare `pump`.
  `Constraints.attacking` is REAL, honest, self-documenting data but is
  **NOT yet consulted by `satisfiesConstraints`** — it's genuine live
  combat state (508.1), not a static `CardDefinition` property, and
  `StaticAttrs`/`resolveSubject` only ever resolve off a `CardDefinition`/
  `TokenLike`, never live engine state — same class of "documented but
  currently inert for matching" field as `targeted`/the `types`-on-event-
  facts limitation already noted above. `card` agent action item: `app/lib/
  factConditions.ts`'s `constraintPhrases` is a hardcoded field list
  (`types`/`cmc`/`power`/`toughness`/`amount`/`name`) — does NOT render
  `attacking` yet. Not a required fix (this field isn't wired to matching
  either, so it's low-priority), but if the card page's own notes/
  conditions column should ever surface "attacking creatures" for Auron's
  Inspiration's own pump fact, that's the function to extend.
- **`buildAnnotatedCard`'s served shape must change** (`server/api/card/
  [set]/[number].ts`, card-owned — engine did not touch this file): drop
  the `annotateOracleText(f.oracleText, allFacts)` call and its
  `oracleLines: AnnotatedSegment[][]` output field entirely. Each face
  should instead serve its real oracle text UNTOUCHED —
  `{ name, manaCost, colorIndicator?, typeLine, oracleText: string,
  power?, toughness? }` (`oracleText` raw, with real `\n`s, not
  pre-split). `app/types.ts`'s `AnnotatedFace`/`AnnotatedCard` need the
  matching type update (`oracleLines` → `oracleText: string`). Whatever
  step turns a card's on-disk `synergy.json` facts into the served
  `functionalModel.synergy` payload (`loadCardSynergy` or wherever that
  lives) must also make sure `sourceText`/`highlight` never leak through —
  they won't be present in a freshly-regenerated `synergy.json` going
  forward, but double-check nothing reads them off a served `Fact` object
  for anything other than annotation computation (engine-side, confirmed
  none do outside `synergy.ts`/`compute-annotations.mjs`).
- **`FunctionalModelText.vue` (card-owned) needs a rewrite** to consume
  `oracleText: string` + each visible fact's own `annotations` directly,
  instead of the pre-built segment tree — i.e. it becomes the thing that
  splits `oracleText` on `\n` and slices out highlighted spans per line,
  using each fact's `annotations[].start`/`.end` against
  `annotations[].line`, rather than receiving pre-split runs. Only the
  `target: 'oracle'` variant is relevant here (a `typeLine`-anchored fact
  has nothing to highlight inline in the oracle-text view).
- **`app/pages/app/card/[set]/[number].vue`'s Facts-table row hover
  `title` currently reads `row.fact.sourceText` directly (around line
  919)** — this field won't be served anymore, so this needs to derive the
  same full-sentence text from `oracleText` + the fact's own first
  `annotations` entry instead (e.g. slice the whole line
  `annotations[0].line` points at, for an `'oracle'`-targeted fact; the
  whole `typeLine` string for a `'typeLine'`-targeted one).
- **`Fact.id` has been removed entirely** (2026-09-11) — user's call:
  facts are short enough now under the annotations model that stable
  cross-regen identity isn't needed. The identity convention is now:
  `role` + `describeFact(fact)`'s own rendered label + the fact's first
  real `annotations` entry (stringified) — NOT `sourceText` (also gone,
  see above) — `synergy.ts`'s own private `factIdentity()` mirrors this
  engine-side (used for `InteractionMatch.theirFactId`). `card` agent must
  update its own `factKey()` (`app/pages/app/card/[set]/[number].vue`,
  `app/components/FunctionalModelText.vue`) to the SAME new tuple (drop
  both the `fact.id ??` branch AND the `sourceText` reference, replace
  with `fact.annotations[0]`), and drop the `fact.id ??` branch from
  `openFactDebugModal`'s modal title. `server/api/graph-links.ts`'s own
  `sourceKey`/`sinkKey` construction (`group.fact.id`) and
  `app/lib/graphRenderer.ts`'s doc-comment mention of `fact.id` also need
  updating to match — see the `engine` agent's own handoff notes for the
  exact call sites.

## Parser-derived facts (`Fact.provenance`) — 2026-09-13, `PRD_AUTOMATED_AUTHORING.md` wiring

`functional-model/recognizers/` (two real recognizers so far —
`instant-sorcery-resolves-to-graveyard`, `permanent-enters-battlefield-normally`
— see `functional-model/PRD_AUTOMATED_AUTHORING.md`) is now wired into real
per-card generated data via `functional-model/scripts/apply-recognizers.mjs`.
Real, checked-in `cards/<slug>/synergy.json` files now carry a mix of
hand-authored facts (unmarked, as always) and parser-derived facts —
**same `Fact` shape either way**, no fork of the vocabulary.

- **New optional field: `Fact.provenance?: { origin: 'parser'; rule: string }`**
  (`synergy.ts`) — present ONLY on a fact a recognizer produced; absent
  entirely on every hand-authored fact (there is still no explicit
  `origin: 'agent'` marker — absence IS the agent-authored signal). `rule`
  names which recognizer (`'instant-sorcery-resolves-to-graveyard'` /
  `'permanent-enters-battlefield-normally'` today — a plain `string` on the
  `Fact` type itself, not a closed union, since `synergy.ts` deliberately
  doesn't import from `recognizers/`; the exhaustive catalog lives in that
  directory's own `RecognizerId`).
- **Purely informational, same bucket as `targeted`/`untilEndOfTurn`/
  `costReductionPerControlled`** — not consulted by `factsInteract`, not
  added to `themeOf`. A parser fact interacts/matches identically to a
  hand-authored one with the same shape; `provenance` never changes
  matching behavior, only who gets credit for having authored the claim.
- **PRD's own acceptance criteria for the `card` side, not yet built**:
  a Facts-tab show/hide toggle for parser-derived facts, and — when
  shown — a small provenance detail (which rule) per row. Until that
  toggle exists, a parser fact will render exactly like any other fact
  (same `describeFact`/`annotations` path — recognizers already produce
  real `Fact.annotations`, computed as a byproduct of the match itself, so
  there is nothing missing for a parser fact to render normally today).
  Per-card human review scope is meant to narrow to agent-authored facts
  only (PRD's Design section) — not implemented on the card side yet
  either; `progress.json`'s `review` field is untouched by this wiring
  pass (still means what it always meant).
- **Real state as of this wiring**: 202 real pool cards' `synergy.json`
  gained new parser-derived facts (435 facts total, additive only — every
  pre-existing hand-authored fact byte-for-byte unchanged, `progress.json`
  untouched anywhere). Two specific cards the user asked to inspect
  personally: `zack-fair` and `ultima` BOTH end up with **zero** new
  parser facts and zero diff at all — both recognizers correctly decline
  them (Zack Fair's own "enters with a counter" is a real CR 614.12
  replacement effect the permanent-recognizer's own criteria excludes on
  purpose; Ultima's own "exile ... including this card" is a real
  self-referential override the instant/sorcery-recognizer declines under)
  — see `PRD_AUTOMATED_AUTHORING.md`'s "Prototype findings" section for
  the full reasoning trail on both; this wiring pass did not change either
  card, on purpose, and did not touch Ultima's own pre-existing (arguably
  wrong, per that same section) hand-authored self-graveyard fact either.
- **`scripts/verify-synergy.mjs` got one small, principled behavior
  change** alongside this wiring: a `provenance.origin === 'parser'` fact
  that has no supporting trace evidence is now a soft NOTE, not a hard
  FAIL (still visible in the report, never silently dropped) — see that
  script's own inline comment at both evidence-check sites for the full
  rationale (in short: many real cards' own `scenarios.ts` only ever
  exercise that card's own distinguishing ability and never bother casting
  it from hand first, which is a pre-existing scenario-coverage gap, not a
  wrong parser verdict, and this PRD's own Design section already
  supersedes any hard trace-verification gate for a parser fact). Every
  hand-authored fact's own hard-failure bar is completely unchanged.
- **Not done in this pass, explicitly out of scope**: the Facts-tab
  toggle/provenance-detail UI, narrowing per-card review scope to exclude
  parser facts, and the separate "rule review" lane for auditing the
  recognizer catalog itself — all still open PRD acceptance criteria,
  `card`-owned (the first two) or not-yet-designed (the third).
- **Third recognizer wired (2026-09-13)**: `destroy-effect-structural`
  (reads a face's structured `Effect[]`, not oracle text) is now also wired
  into `apply-recognizers.mjs` — same `rule` string on `Fact.provenance`,
  no new served-shape field. At the time this bullet was written,
  `summon-bahamut` (fin/1) itself got NO new provenance-tagged fact from
  this recognizer (dedup against its own already-identical hand-authored
  `event:'destroy'` fact left it untouched/unprovenanced) — **superseded by
  the dedup-retagging bullet immediately below; left here only as a
  historical record of that specific pass, not current behavior.**
- **Dedup-match retagging (2026-09-13, follow-up pass; simplified again
  2026-09-14 — see below, this bullet is a historical record of the FIRST
  version of this behavior, not current)** — the "already-covered, leaves
  it untouched/unprovenanced" behavior described above (and in
  `apply-recognizers.mjs`'s own pre-existing `coreKey` dedup) is gone. When
  a recognizer's derived fact dedups against an ALREADY hand-authored fact
  that has no `provenance` yet, that existing fact was RETAGGED IN PLACE:
  same `Fact.provenance` shape, plus a `FactProvenance.note?: string`
  documenting that it predates the recognizer, every other field
  (`value`/`annotations`/`controller`) left byte-for-byte untouched.
- **Dedup-match retagging simplified (2026-09-14)** — the conservative
  preserve-and-note behavior above is retired outright, not kept as an
  option, per an explicit design decision: `value` is deprecated pool-wide
  (not consulted by anything that actually matches/interacts facts) and a
  recognizer's own `annotations` being broader/narrower/differently-placed
  than a hand-authored span was never a real conflict either (`coreKey`
  already excludes `annotations` from the match test for that exact
  reason). A `coreKey` match now uniformly REPLACES the existing fact's
  `value`/`annotations` with the recognizer's own freshly-computed ones and
  sets a bare `provenance: { origin: 'parser', rule }` — no distinction
  anymore between a fresh recognizer-originated fact and a `coreKey` match
  against a previously hand-authored (or previously retagged) one.
  `FactProvenance.note` has been removed from the type entirely (confirmed
  unread anywhere under `app/`/`server/` first). Still a genuine decline,
  never merged: anything that makes `coreKey` itself not match in the first
  place (a different `target`/`subject`/zone shape, etc.) — unaffected by
  this change, `coreKey`'s own computation is unchanged.
  `cards/summon-bahamut/synergy.json`'s `dealDamage-effect-structural` fact
  is the concrete example: `value` changed from its old hand-authored `5`
  to the recognizer's own fixed `1` (previously preserved, now
  overwritten). Pool-wide re-run: 98 files changed, 231 existing facts
  retagged (187 of which previously carried a now-removed `note`), 0 hard
  failures, confirmed idempotent across 3 consecutive runs (`grep -rl
  '"note"' cards/*/synergy.json` → 0 matches). See
  `PRD_AUTOMATED_AUTHORING.md`'s "Dedup-match retagging simplified
  (2026-09-14)" section for the full breakdown.
- **Real bug found+fixed alongside this same pass, `card`-owned file**:
  `server/api/recognizer-source/[rule].get.ts`'s hand-kept `RECOGNIZER_IDS`
  runtime array had not been widened to include `'destroy-effect-
  structural'` when that recognizer was wired, even though the engine-owned
  `RecognizerId` type it mirrors already had it — every `destroy`-fact
  provenance popover 404'd until this was fixed (one array literal, `engine`
  fixed it directly since it was blocking this same pass's own live-browser
  verification; flagged here since the file is `card`-owned).
- **Fourth recognizer added (2026-09-13): `drawCard-effect-structural`** —
  same structural-Effect-reading approach as `destroy-effect-structural`
  (see `functional-model/recognizers/drawCard-effect-structural.ts`'s own
  module doc comment and `PRD_AUTOMATED_AUTHORING.md`'s new section for the
  full reasoning trail), now reading `kind: 'drawCard'` `Effect`s instead of
  `kind: 'destroy'`. Same served `Fact` shape, no new field —
  `Fact.provenance.rule` is now one of 4 strings. `RECOGNIZER_IDS` in
  `server/api/recognizer-source/[rule].get.ts` was updated ALONGSIDE this
  wiring pass this time (not as a follow-up fix) specifically to avoid
  repeating the exact `destroy-effect-structural` 404 above — confirmed via
  live-browser hover on `/app/card/fin/1`'s own "Card draw" row: the
  provenance popover returns the real recognizer source, no 404.
  `summon-bahamut` (fin/1)'s own chapter III `drawCard` fact is now
  provenance-tagged (retagged in place — its own real `value: 4` untouched).
- **Real, narrow fix alongside this pass, `functional-model/scripts/
  apply-recognizers.mjs`** (engine-owned, not a `card`-side change, noted
  here only because it affects what a served `Fact.provenance` can now
  cover pool-wide): the dedup/retag path's `existingByKey` lookup used to
  assume at most one existing fact could ever share a bare `coreKey` — real,
  false for `qiqirn-merchant` (2 genuinely different `event:'drawCard'`
  facts reducing to the same key) and `matoya-archon-elder` (2 facts
  sharing a key that are NOT the same real claim — one anchored to its real
  ability text, one to its own reminder-text parenthesis). Fixed to store a
  `Fact[]` per key, requiring an exact `annotations` match to disambiguate
  whenever more than one candidate shares a key (falls back to the
  single-candidate behavior, unchanged, when only one exists) — see that
  script's own updated header comment for the full reasoning and the
  matoya-archon-elder case that forced the annotation-match requirement (a
  naive "first unprovenanced candidate" policy was tried and reverted after
  it non-idempotently retagged the wrong fact on a second run).
- **Fifth recognizer added (2026-09-13): `saga-lore-and-sacrifice-
  structural`** — genuinely different input shape from the other two
  structural recognizers: reads a face's own `typeLine` + named
  `triggers` (never `Effect[]` shapes, never oracle text at all — see
  `functional-model/recognizers/saga-lore-and-sacrifice-structural.ts`'s
  own module doc comment and `PRD_AUTOMATED_AUTHORING.md`'s new section
  for the full reasoning trail), mirroring the real engine's own
  `functional-model/saga.ts` derivation. Produces an unconditional
  `putCounter`(LORE)/self fact for every real Saga, PLUS a conditional
  `sacrifice`+`dies` self-pair (declined whenever the Saga's own final
  chapter has any `kind:'custom'` effect — see that file's doc comment for
  the real per-card reasoning, including two deliberate divergences from
  existing hand-authored data: `summon-leviathan` and `crystal-fragments-
  summon-alexander`). Same served `Fact` shape, no new field —
  `Fact.provenance.rule` is now one of 5 strings. `RECOGNIZER_IDS` in
  `server/api/recognizer-source/[rule].get.ts` was updated ALONGSIDE this
  wiring pass (not a follow-up fix) — confirmed via live-browser hover on
  `/app/card/fin/1`'s "Counters"/"Sacrifice"/"Dies" rows (200, not a 404)
  and on `/app/card/fin/58` (Jill, Shiva's Dominant // Shiva, Warden of
  Ice)'s back face, which correctly shows only the "Counters" row
  provenance-tagged (no sacrifice/dies row at all — the lore-only, real
  transform-back outcome). `summon-bahamut` (fin/1)'s own `putCounter`/
  `sacrifice`/`dies` facts are now all 3 provenance-tagged (retagged in
  place — their own real legacy `-1`/`-1`/`1` values untouched).
- **Duplicate-fact handling moved from each recognizer to one shared
  runner-level pass, and generalized (2026-09-13, follow-up)** — 3 of the 5
  structural/text recognizers used to each keep their own bespoke per-face
  `seen` Set (exact `JSON.stringify(fact)` match, `annotations` included);
  that's gone now, replaced by `apply-recognizers.mjs`'s own
  `mergeRecognizedFactsByIdentity` (fresh recognizer output, grouped by the
  same reduced identity `coreKey` already uses) plus a second, narrower
  existing-on-disk self-heal (`mergeSameRuleExistingFacts`, for a pool
  already retagged by a PRIOR run before this generalization existed). Net
  effect, real and intentional: **`Fact.annotations` can now legitimately
  have length > 1 where two genuinely different real clauses assert the
  identical claim** — first real, checked-in example is `qiqirn-merchant`
  (fin/65)'s own `event:'drawCard'` fact, unioning its `cantrip` ability's
  span and its `bigDraw` ability's span into one fact (previously served as
  2 separate `drawCard` facts). Confirmed via live `/api/card/fin/65` —
  `functionalModel.synergy` now serves exactly one `drawCard` fact with a
  2-entry `annotations` array. Pool-wide re-run confirmed this is the ONLY
  card whose on-disk `synergy.json` changed as a result (idempotent, 2
  further runs write 0 files).
  - `card`-side spot-check done as part of this same pass (engine-owned
    check, not a fix): `FunctionalModelText.vue`'s own inline oracle-text
    highlighting already iterates a fact's FULL `annotations` array (`for
    (const ann of f.annotations ?? [])`, both the `'oracle'` and `'typeLine'`
    branches), so it already highlights BOTH real spans correctly for a
    merged fact like this one — no gap there.
  - **Real, narrow gap found, NOT fixed (out of scope for this pass,
    flagged for `card`)**: the Facts-table row's own hover tooltip
    (`factSourceText`, `app/pages/app/card/[set]/[number].vue` around line
    616) and its `factKey` (same file, ~line 335) both only ever read
    `fact.annotations?.[0]` — for `qiqirn-merchant`'s own merged fact this
    means the row tooltip shows only the `cantrip` ability's own line text,
    never surfacing the `bigDraw` ability's own second span at all. Every
    fact before this pass had at most one real annotation, so this was
    never previously reachable; now that a merged fact can carry more than
    one, `card` may want `factSourceText` to represent all of them (e.g.
    joined text, or the row's own key not silently ignoring later entries).

## `Fact.value` removed from the schema entirely (2026-09-14)

Not a further step in the "deprecated pool-wide" status this field already
had (this file previously already said `value` was "not consulted by
anything that actually matches/interacts facts") — a hard, explicit user
instruction to wipe it out of the project completely: "let's remove value
from everything (edges, facts, etc). No -1, no nothing."

- `Fact.value`/`Weight`/`factTotal()`/`InteractionMatch.theirTotal`
  (`functional-model/synergy.ts`) are all gone. A served `Fact` (both the
  raw `synergy.json` source/sink arrays AND `InteractionGroup.fact`) never
  carries a `value` key anymore — confirmed via a pool-wide grep, zero
  remaining `"value"` keys under any fact object in any
  `cards/<slug>/synergy.json`.
- `functional-model/scripts/compute-weights.mjs` (whose entire job was
  computing/writing this field) is deleted outright, not gutted-and-kept.
- Every recognizer in `functional-model/recognizers/` stopped emitting
  `value` on facts it produces; `apply-recognizers.mjs`'s dedup/retag logic
  (which already excluded `value` from its `coreKey` identity comparison)
  no longer reads or writes `.value` anywhere.
- `theirTotal`'s only real consumer, `server/api/card/[set]/[number].ts`'s
  own `dedupMatchesByCard`, now keeps the FIRST-encountered duplicate match
  per card instead of the highest-`theirTotal` one when collapsing
  per-fact matches down to one gallery entry per related card — a benign,
  arbitrary-tiebreak change (`theirTotal` was never part of the served
  payload either way, so nothing client-visible changes). `card` agent:
  if a future pass wants a MORE meaningful tiebreak than "first
  encountered," that's a fresh design decision, not a restoration of the
  old `value`-based one.
- **`card`-owned UI cleanup done directly by `engine` this same pass** (small,
  mechanical, forced by the type removal — flagged here rather than done
  silently): `app/components/ValueBar.vue` deleted (its only two call
  sites — `app/components/FunctionalModelText.vue`'s hover tooltip and
  `app/pages/app/card/[set]/[number].vue`'s Facts-table column — were both
  already display-disabled or about to become dead code); the Facts-table's
  `SHOW_FACT_VALUE_COLUMN` flag, its `<td>`, and the value-aware `colspan`
  branch are gone too, not just toggled off.
- **New (2026-09-14): printed Lifelink is no longer a hand-authored
  `Fact` at all.** 11 real pool cards used to carry an explicit
  `{event:'lifegain', controller:'you'}` SOURCE fact whose entire basis was
  a literal restatement of the card's own printed Lifelink keyword (no
  separate lifegain ability text) — dropped pool-wide. Real synergy-
  matching coverage doesn't regress: `synergy.ts`'s `findInteractionsForCard`
  now synthesizes the equivalent fact at MATCH TIME (`hasPrintedLifelink`/
  `syntheticLifelinkFact`) for any card with printed Lifelink (front or
  back face) that doesn't already declare a real one of its own (Battle
  Menu's own genuinely separate "Item — you gain 4 life" mode is
  unaffected, still its own real declared fact). This synthetic fact is
  NEVER written to any `synergy.json` and deliberately has NO
  `annotations` (there's no authored oracle-text span to point at — the
  keyword itself is the anchor, and `synergy.ts` has no access to a card's
  real Scryfall oracle text to compute one) — safe because nothing in
  `factsInteract`/`themeOf`/`describeFact` dereferences `annotations` for
  a bare event fact like this, and nothing in served UI renders an
  `InteractionGroup.fact`'s `annotations` as visible text (only
  `group.description`, itself a `describeFact()` string, and
  `group.matches` are ever shown — checked directly against
  `app/pages/app/card/[set]/[number].vue`). **Known, deliberate
  consequence**: these 11 cards' own Facts tab (fed from raw `synergy.json`,
  NOT from this synthesized-at-match-time path) no longer shows a
  "lifegain" row at all — intended, not a regression: the point was
  removing the redundant row, and the printed "Lifelink" keyword is still
  visible elsewhere on the card display.
- **Confirmed discrepancy, flagged, NOT silently resolved**: the task that
  drove this removal named `cecil-dark-knight-cecil-redeemed-paladin` as
  one of 5 "genuine, no Lifelink keyword at all" cards to leave untouched —
  but its own `definition.ts` `backFace` (`Cecil, Redeemed Paladin`)
  DOES declare `keywords: ['Lifelink']`, with no other lifegain-producing
  ability anywhere on that face. Its `{event:'lifegain', ..., face:'back'}`
  fact is, on inspection, the exact same redundant-restatement shape as the
  11 that WERE dropped. Left untouched per the explicit literal instruction
  ("do NOT touch these 5"), not auto-corrected — a human should decide
  whether to fold it into the same removal in a follow-up.

- `card` agent must not assume anything about `Effect` kinds or
  `resolveCard()` internals beyond what's in `synergy.json`/`trace.json` —
  if presenting a fact requires reading `definition.ts` directly, that's a
  sign the generated output is missing something; flag it for `engine`
  rather than reaching into `functional-model/*` yourself.
- `engine` agent must not assume how `synergy.json`/`trace.json` get
  rendered — UI presentation concerns (grouping, labels, collapse/expand)
  belong to `card`.

**Engine has no connection to card/UI, full stop.** Logging or similar
instrumentation baked into engine code is fine; engine code being
imported and executed by a UI component, or engine changing anything
under `app/`/`server/api/`, is not. Known current violation:
`describeFact`/`constraintBits` (label-templating logic) live in
engine-owned `functional-model/synergy.ts` but are imported and called
directly by the card page component at render time — that's backwards
from this rule and should eventually move to card-owned code (engine
would keep owning the raw `Fact`/`Constraints` vocabulary those functions
read, just not the templating itself). Not urgent, but don't add more
engine-owned functions to that import going forward.
