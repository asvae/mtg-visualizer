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
- `progress.json` — review/tagging progress state. Includes
  `textCoverageAudited: boolean` and `knownGaps: string[]` — hand-maintained
  by whichever agent last touched this card's facts, so treat them as
  advisory, not guaranteed-accurate (a card's own facts can change without
  someone remembering to update these two fields — confirmed stale on
  `ashe-princess-of-dalmasca`, 2026-09-15, see below).

### `factsTextCoverage` (informational, engine-computed, 2026-09-15)

A REAL, computed signal — genuinely different from (and stronger than)
"every fact has an annotation" (`scripts/annotation-coverage.mjs`'s own
check, which is blind to whether the CARD'S OWN FULL ORACLE TEXT has a
substantial clause with no fact/annotation pointing at it at all).
`functional-model/scripts/text-coverage.mjs` (`computeTextCoverage`) unions
every real `{target:'oracle', ...}` annotation span onto a card's own real
oracle text, per face, and reports:
- `ratio` — fraction of real (non-reminder-text, non-punctuation) characters
  covered by at least one fact's annotation.
- `gaps` — every real, substantial (20+ real characters after stripping a
  leading "<ability name/Saga chapter/modal bullet> — " label, since this
  pool's own narrow-per-clause annotation convention deliberately never
  anchors those) contiguous uncovered span, as `{face, line, start, end,
  text}`.

Run via `npx vite-node functional-model/scripts/verify-text-coverage.mjs
[--threshold=0.85] [slug...]` — **informational only, never a hard-fail**
(real, honest partial coverage is a normal, expected state for most of this
pool — a 2026-09-15 whole-pool run found 246/300 v2-shaped cards below the
default 85% threshold, almost entirely cards whose own `progress.json`
never claimed full coverage in the first place, not a mass discovery of
stale metadata). Not wired into `npm run test`/CI for that reason; a
per-card `card` agent UI surfacing this (a "facts may be incomplete" badge,
e.g.) should treat a LOW ratio as "worth a human glance," never as a defect
to auto-fix.

**Real motivating case**: `ashe-princess-of-dalmasca` (fin/7) — its own
`progress.json` claimed `textCoverageAudited: true`/`knownGaps: []`, but
`computeTextCoverage` found two real, substantial, genuinely uncovered
clauses ("look at the top five cards of your library" and "Put the rest on
the bottom of your library in a random order" — both plausibly inert for
synergy purposes, a same-zone Library reposition with no external hook, but
real oracle text nonetheless with zero fact/annotation pointing at them).
Reset to `textCoverageAudited: false` with a real `knownGaps` entry
recording this finding — see that card's own `progress.json`.

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

`functional-model/recognizers/` (two real recognizers at first —
`instant-sorcery-resolves-to-graveyard`, `permanent-enters-battlefield-normally`
— **both now RETIRED** (the latter 2026-09-14, the former the same day,
third instance of this exact pattern — see this file's own dated entries
further down: "a normal permanent's self-cast/self-entersBattlefield fact
pair is no longer hand/parser-authored `Fact` data at all" and "a normal
Instant/Sorcery's self-cast-from-Hand/self-graveyard fact pair is no longer
hand/parser-authored `Fact` data at all") — see
`functional-model/PRD_AUTOMATED_AUTHORING.md`) is now wired into real
per-card generated data via `functional-model/scripts/apply-recognizers.mjs`.
Real, checked-in `cards/<slug>/synergy.json` files now carry a mix of
hand-authored facts (unmarked, as always) and parser-derived facts —
**same `Fact` shape either way**, no fork of the vocabulary.

- **New optional field: `Fact.provenance?: { origin: 'parser'; rule: string }`**
  (`synergy.ts`) — present ONLY on a fact a recognizer produced; absent
  entirely on every hand-authored fact (there is still no explicit
  `origin: 'agent'` marker — absence IS the agent-authored signal). `rule`
  names which recognizer produced it — today's real, still-active catalog
  is `destroy-effect-structural`, `drawCard-effect-structural`,
  `saga-lore-and-sacrifice-structural`, `dies-trigger-structural`,
  `lifegain-trigger-structural`, `dealDamage-effect-structural`,
  `putCounter-broadcast-structural`, `attacks-trigger-structural`,
  `putCounterTarget-effect-structural`, `addMana-effect-structural`,
  `putCounterSelf-effect-structural`, `putCounterMagnitude-clause-structural`
  (the last 2 added 2026-09-14, closing Aerith Gainsborough's own last 2
  unprovenanced facts — see `functional-model/PRD_AUTOMATED_AUTHORING.md`'s
  own dated entry)
  (`instant-sorcery-resolves-to-graveyard`/
  `permanent-enters-battlefield-normally` can no longer appear on any fact
  — both retired, see below) — a plain `string` on the `Fact` type itself,
  not a closed union, since `synergy.ts` deliberately doesn't import from
  `recognizers/`; the exhaustive catalog lives in that directory's own
  `RecognizerId`).
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
- **PARKED (2026-09-14, later same day), by explicit user decision — not
  removed.** The `hasPrintedLifelink`/`syntheticLifelinkFact` match-time
  synthesis described in the two bullets above is being reconsidered and
  may come back later; `synergy.ts` keeps both functions in place as
  dead/draft code but the injection itself is now a hard no-op behind
  `const LIFELINK_SYNTHETIC_FACT_ENABLED = false`. The 12 real cards this
  used to cover (the 11 above plus Cecil, Redeemed Paladin's own back-face
  fact, folded in as part of this same restoration) have their own
  explicit `{event:'lifegain', controller:'you', ...}` SOURCE fact back in
  `synergy.json` (same shape as before, minus `value` — that field stays
  permanently gone project-wide, unrelated to this reversal). The paired
  `synergy.test.ts` describe block is `describe.skip`, not deleted, ready
  to re-enable alongside the flag. The OTHER two synthetic patterns
  (`isNormalPermanent`/`isNormalInstantOrSorcery`) are NOT part of this
  decision and remain fully active.

- **New (2026-09-14): a normal permanent's self-`cast`/self-
  `entersBattlefield` fact pair is no longer hand/parser-authored `Fact`
  data at all — same pattern the Lifelink removal above already
  established, applied to `permanent-enters-battlefield-normally`
  (`functional-model/recognizers/`) instead of a printed keyword.** 210
  real pool cards used to carry an explicit, parser-derived
  (`provenance.rule: 'permanent-enters-battlefield-normally'`) `{event:
  'cast', from:'Hand', target:'self'}` + `{event:'entersBattlefield',
  to:'Battlefield', controller:'you', subject:'self', target:'self'}` pair
  — a literal restatement of "this is a normal permanent," confirmed
  (pool-wide field scan, all 420 tagged facts) to carry no case with any
  extra real constraint beyond that canonical shape. Dropped pool-wide.
  Real synergy-matching coverage doesn't regress: `synergy.ts`'s
  `findInteractionsForCard` now synthesizes the equivalent pair at MATCH
  TIME (`isNormalPermanent`/`syntheticCastFact`/
  `syntheticEntersBattlefieldFact`) for any non-token permanent (Creature/
  Artifact/Enchantment/Planeswalker/Battle — a Land is played, not cast,
  same exclusion the retired recognizer used) that doesn't already declare
  a real self-cast/self-entersBattlefield fact of its own. Same "never
  written to any `synergy.json`, no `annotations`" treatment the synthetic
  Lifelink fact already gets, same reasons.
  - **The recognizer file itself is deleted**
    (`functional-model/recognizers/permanent-enters-battlefield-normally.ts`),
    not kept inert — its whole scope was producing these two facts.
    Removed from `apply-recognizers.mjs`'s `RECOGNIZERS` list and from
    `recognizers/types.ts`'s `RecognizerId` union (a fact carrying this
    `provenance.rule` string can no longer exist anywhere in the pool).
    `server/api/recognizer-source/[rule].get.ts`'s hand-kept
    `RECOGNIZER_IDS` mirror was updated to match by `engine` directly (same
    "small, mechanical, blocking, card-owned file" precedent the
    `destroy-effect-structural` miss earlier in this file already
    established) — `card`/`server` should still double check nothing else
    hand-lists this rule id (a concurrent, in-flight `server/api/
    recognizers/index.get.ts` edit at the time of this pass still has a
    stale `'permanent-enters-battlefield-normally'` display-label entry;
    engine left it alone since that file was mid-edit by another session,
    but it's now a dead label for a rule that can never appear on a served
    fact again).
  - **One deliberate, known, small broadening this removal can't avoid**:
    the retired recognizer used to DECLINE this pair for a card whose own
    oracle text describes its own entrance as modified (enters tapped/with
    a counter/as a copy/face down, CR 614.12) — a distinction
    `isNormalPermanent` can no longer make, since `CardDefinition` has no
    structured "enters tapped" field anywhere (confirmed: the 3 real pool
    cards with this shape — `tonberry`, `shambling-cie-th`, `elixir` — all
    model it as an ordinary `onEnter` trigger effect tapping/counter-ing a
    pool-filtered candidate, a shape structurally IDENTICAL to a
    genuinely different card's own ETB trigger targeting something else
    entirely, e.g. `cloudbound-moogle`/`ice-flan`). These 3 cards (plus 17
    more that simply predate `apply-recognizers.mjs` ever running on them —
    either a not-yet-migrated empty `synergy.json`, or a real card outside
    that script's own oracle-text lookup, e.g. the historical-sets sweep;
    all 17 confirmed ordinary permanents by direct inspection, nothing
    entering abnormally) now get the synthetic pair for the first time.
    Not a correctness regression — the CAST/ENTERS events are still
    literally true either way, only the optional `tapped` field (which the
    old recognizer never set either) is left unconstrained rather than
    unclaimed — but a real, visible behavior change from before this pass,
    flagged here rather than silently absorbed into "removed the redundant
    fact" framing. See `functional-model/synergy.ts`'s `isNormalPermanent`
    doc comment for the full reasoning.
  - **Genuine special case confirmed kept, unaffected by this change**:
    `zack-fair`'s own hand-authored "enters with a +1/+1 counter" pair (CR
    614.12, no `provenance` tag — the recognizer always declined it) is
    untouched (nothing to strip, no `provenance.rule` tag on it) and never
    gets a synthetic duplicate layered on top (`findInteractionsForCard`'s
    own "already declared" skip, same as a card with its own real lifegain
    ability skips the synthetic Lifelink fact). No OTHER genuine special
    case was found among the 210 recognizer-tagged cards — every one was
    either the exact canonical shape or a harmless schema-drift variant
    (a stale pre-`subject`-field `entersBattlefield`, or a redundant
    explicit `controller:'you'` on `cast` that `effectiveController`
    already derives for free).
  - **Known, accepted card-side consequence, same shape as the Lifelink
    one above**: these 210 cards' own Facts tab no longer shows "Cast a
    spell"/"Enters the battlefield" rows for this pair at all (fed from raw
    `synergy.json`, not the synthesized-at-match-time path) — intended, not
    a regression. Live-verified via a running dev server against
    `fin/87` (Ahriman): `functionalModel.synergy.source` no longer lists
    `cast`/`entersBattlefield`, while the Interactions tab and
    `/api/graph-links` both still show a real, populated
    `entersBattlefield` produce group/edge (127 matches / 261 real "enters
    the battlefield" edges touching Ahriman alone) via the synthesized
    fact — the Interactions/graph path was unaffected by the removal.

- **New (2026-09-14, same day, third instance of this exact pattern): a
  normal Instant/Sorcery's self-`cast`-from-Hand/self-graveyard fact pair
  is no longer hand/parser-authored `Fact` data at all** — same pattern
  the Lifelink and normal-permanent removals above already established,
  applied to `instant-sorcery-resolves-to-graveyard`
  (`functional-model/recognizers/`) instead. 62 real pool cards used to
  carry an explicit, parser-derived (`provenance.rule:
  'instant-sorcery-resolves-to-graveyard'`) `{event:'cast', from:'Hand',
  target:'self'}` + `{to:'Graveyard', controller:'you', subject:'self'}`
  pair — a literal restatement of "this is a normal Instant/Sorcery,"
  confirmed (pool-wide field scan, all 124 tagged facts) to carry no case
  with any extra real constraint beyond that canonical shape. Dropped
  pool-wide. Real synergy-matching coverage doesn't regress: `synergy.ts`'s
  `findInteractionsForCard` now synthesizes the equivalent pair at MATCH
  TIME (`isNormalInstantOrSorcery`/`syntheticCastFact` — reused verbatim
  from the normal-permanent case, since the CAST half is the byte-identical
  real fact either way — `/syntheticInstantSorceryGraveyardFact`) for any
  non-Adventure Instant/Sorcery that doesn't already declare a real
  self-cast-from-Hand/self-graveyard fact of its own. Same "never written
  to any `synergy.json`, no `annotations`" treatment the synthetic
  Lifelink/normal-permanent facts already get, same reasons.
  - **The recognizer file itself is deleted**
    (`functional-model/recognizers/instant-sorcery-resolves-to-
    graveyard.ts`), not kept inert — its whole scope was producing these
    two facts. Removed from `apply-recognizers.mjs`'s `RECOGNIZERS` list
    and from `recognizers/types.ts`'s `RecognizerId` union (a fact carrying
    this `provenance.rule` string can no longer exist anywhere in the
    pool). `server/api/recognizer-source/[rule].get.ts`'s hand-kept
    `RECOGNIZER_IDS` mirror was updated to match by `engine` directly, same
    "small, mechanical, blocking, card-owned file" precedent the
    `destroy-effect-structural` miss/`permanent-enters-battlefield-normally`
    removal already established. **Not yet checked/fixed**: `server/api/
    recognizers/index.get.ts`'s own separate, hand-kept `TITLES` display-
    label map still has a `'instant-sorcery-resolves-to-graveyard'` entry —
    non-blocking (that map is a plain `Record<string,string>`, not typed
    against `RecognizerId`, so it compiles fine either way) but now a dead
    label for a rule that can never appear on a served fact again, same
    situation the `permanent-enters-battlefield-normally` removal flagged
    for that file at the time (since resolved — that stale entry is gone
    from `TITLES` today); `card`/`ui` should clean up the new one the same
    way when next touching that file.
    `recognizers/recognizers.test.ts` (the dedicated test file for both
    original text-only prototype recognizers, "Recognizer A"/"Recognizer
    B") is ALSO deleted outright, not left with an inert comment-only body
    — Recognizer B's own retirement had already reduced this file to "one
    real describe block (A) plus one retirement comment (B)"; retiring A
    too would have left zero actual tests, which Vitest hard-fails on
    ("No test suite found in file") rather than silently skipping. The
    equivalent describe block in `functional-model/synergy.test.ts` (see
    below) is the durable, still-executing record of this recognizer's own
    real accept/decline cases.
  - **One deliberate, known, small broadening this removal can't avoid**:
    the retired recognizer used to DECLINE this pair for a card whose own
    oracle text names a genuinely self-referential exile/shuffle override
    ("including/exile/shuffle this card/spell") — a distinction
    `isNormalInstantOrSorcery` can no longer make, since `CardDefinition`
    carries no oracle text at all (`synergy.ts` has no access to a card's
    real Scryfall body text to check for this). Checked directly
    (2026-09-14): the ONLY real pool card the retired recognizer ever
    declined for this reason, `ultima`, already carries its own
    hand-authored (untagged, no `provenance`) self-cast/self-graveyard fact
    pair regardless — the recognizer's own module doc comment already
    called this "a likely-latent gap in that specific hand-authored card,
    not something this recognizer should replicate," so `ultima` keeping
    that pair (now via the "already declared, skip the synthetic
    duplicate" guard) is not a new regression, just the same pre-existing
    state under a new mechanism.
  - **Genuine special case confirmed kept, unaffected by this change**:
    Adventure instant/sorcery halves (CR 715.3d — exiled, not put into the
    graveyard, on resolution; every real Adventure half in this pool prints
    "Adventure" as a literal typeLine subtype) are still excluded by a
    structural typeLine check `isNormalInstantOrSorcery` reuses verbatim
    from the retired recognizer's own `isAdventure` — confirmed none of the
    5 real FIN Town//Adventure cards' own Adventure halves gain this pair.
    Flashback/"cast from a graveyard" cards (`auron-s-inspiration`,
    `from-father-to-son`, `dreams-of-laguna`, `retrieve-the-esper`, and
    siblings) are deliberately NOT treated as a special case, matching the
    retired recognizer's own explicit reasoning: their normal cast-from-
    Hand resolution still goes to the graveyard exactly like any other
    Instant/Sorcery, so they correctly keep BOTH their own genuinely
    distinct, separately-authored `{event:'cast', from:'Graveyard', ...}` +
    `{to:'Exile', ...}` Flashback-recast facts (real, card-specific data)
    AND the synthetic normal-Hand-cast/graveyard pair — the synthetic-fact
    "already declared" dedup guard checks `from: 'Hand'` specifically
    (narrower than the normal-permanent case's own check) for exactly this
    reason, so a Flashback card's own real `from: 'Graveyard'` fact can
    never wrongly suppress the synthetic `from: 'Hand'` one. **Not directly
    observable via `findInteractionsForCard`'s own group output** (a
    `from`-only fact is genuinely zone-shaped but has no resolvable
    `effectiveZone`, so `factsInteract` always returns `false` for it,
    regardless of whether the dedup guard fired correctly or wrongly —
    same structural blind spot `synergy.test.ts`'s own normal-permanent
    describe block already documents for its own cast fact) — verified by
    direct code inspection instead, and via the real pool
    (`auron-s-inspiration`/`from-father-to-son` genuinely keep their own
    distinct `from: 'Graveyard'` fact after the strip, confirmed directly).
  - **`functional-model/scripts/verify-synergy.mjs` also updated** — its
    reverse "every produce-relevant ACTION must be explained" check reads
    each card's raw on-disk `source` array directly (no visibility into
    `synergy.ts`'s own match-time synthesis), and `harness.ts`'s scenario
    runner naturally logs a real `{fn:'move', from:'stack', to:'Graveyard'}`
    trace entry for nearly every plain Instant/Sorcery scenario — so
    stripping the stored fact pool-wide surfaced ~20 brand-new soft notes
    before this fix (confirmed via a before/after comparison scoped to all
    62 affected cards). Added `isNormalInstantOrSorceryGraveyardMove` (same
    structural mirror of `isNormalInstantOrSorcery`, same "note-not-fail,
    now correctly suppressed" treatment the file's own `moveTo`-to-Exile
    promotion comment already established for an analogous case) to that
    reverse check. Reverified after the fix: the scoped 62-card comparison
    and the FULL pool's own before/after output are now byte-identical.
  - **Known, accepted card-side consequence, same shape as the Lifelink/
    normal-permanent ones above**: these 62 cards' own Facts tab no longer
    shows "Cast a spell"/"graveyard presence" rows for this pair at all
    (fed from raw `synergy.json`, not the synthesized-at-match-time path)
    — intended, not a regression.
  - **Live-verified, not just JSON-level** (per standing convention):
    started a real `nuxt dev` instance (a different port — another
    session already held :3000), curled `/api/card/fin/5` (Aerith Rescue
    Mission, one of the 62 stripped cards) — `functionalModel.synergy
    .source` no longer lists `cast`/the bare graveyard fact, but
    `interactions` still shows a real, populated synthesized `{to:
    'Graveyard', subject:'self'}` source group (13 matches), and
    `/api/graph-links?set=fin` shows 176 total edges touching Aerith
    Rescue Mission, 13 of them graveyard-presence edges via the
    synthesized fact. Dev server stopped after (confirmed port free); a
    DIFFERENT, unrelated `nuxt dev` process on :3000 was already running
    under some other session — left alone, not mine.

- **New recognizers (2026-09-14, fin/3-10 mechanization pass)**: 6 more
  wired into the real pipeline, `Fact.provenance.rule` is now one of 20
  strings — `ptFormula-scalingPump-structural`, `digReveal-effect-
  structural`, `flashback-alternateCost-structural`, `gainLife-effect-
  structural`, `landfall-trigger-structural`, `triggerDoubling-
  selfAndAttachedEquipment-structural` — plus `destroy-effect-structural`
  extended to also emit a paired SINK fact (only when its own `target`
  narrows to a real type filter). See `functional-model/
  PRD_AUTOMATED_AUTHORING.md`'s own dated section for the full per-
  recognizer whole-pool-check reasoning and the real declines (token
  creation, "fixed pump," Cloud's own search-for-Equipment `validType`
  divergence) left hand-authored on purpose. `card`/`server` action items:
  same as every prior recognizer addition — `server/api/recognizer-source/
  [rule].get.ts`'s `RECOGNIZER_IDS` and `functional-model/recognizers/
  types.ts`'s `RecognizerId` union both updated this pass (not left as a
  follow-up miss); `server/api/recognizers/index.get.ts`'s `TITLES` map
  was NOT updated for these 6 (that map already falls back to a
  title-cased id when absent, same as most existing recognizers).
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
