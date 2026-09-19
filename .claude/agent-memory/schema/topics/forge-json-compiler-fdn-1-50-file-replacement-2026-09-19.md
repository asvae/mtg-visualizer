# forge-json-compiler promoted to real pipeline tool + 23-card file replacement (2026-09-19)

User-confirmed decision (not to relitigate): for the cards the
forge-json-compiler compiles cleanly, its own output IS now the real
transcription — replacing whatever was in `fdn-cards/<slug>/definition.ts`.
This task did that for real, plus promoted the tool itself out of
`scripts/experiments/`.

## New permanent location

`functional-model/scripts/experiments/forge-json-compiler/` ->
`functional-model/scripts/forge-json-compiler/` (plain `mv`, dir was
untracked). All relative imports fixed (one fewer `../` level); the
sibling `forge-json-mapper` tool (its real Forge JSON `output/`, still
gitignored/local-only) was deliberately NOT moved — it's still genuinely
an experiment (untracked output, no promotion ask) — so the compiler's own
path to it is now `../experiments/forge-json-mapper/output`. External
importers fixed: `server/utils/forgeJsonCompiler.ts`,
`functional-model/matcher-model/catalog/counters.test.ts`. Doc-comment
"EXPERIMENT"/"probe"/"feasibility" framing dropped throughout the moved
files (compile-forge-card.ts/fdn-1-50.test.ts/fdn-1-50-cases.ts/
load-token-scripts.ts/diff.ts/run-experiment.ts) — the "throw on any
unhandled Forge shape" design principle stays exactly as-is, restated as a
real strength not an experimental caveat. `.gitignore`'s forge-json-mapper
comment reworded to reflect the split (mapper still an experiment, compiler
now real pipeline tooling that happens to depend on the mapper's
gitignored output).

Two NEW permanent files in the same dir:
- `write-fdn-definition.ts` — `renderDefinitionFile(definition, exportName)`,
  a real, literal `CardDefinition` -> TS-source serializer (single-quoted
  strings, unquoted-when-valid object keys, `satisfies Effect` suffix on
  every `CardDefinition.effects[]`/`Trigger.effects[]` entry, `Effect` type
  import omitted when the card has none — sire-of-seven-deaths is the real
  precedent). Deliberately does NOT fold a `createToken` token literal that
  happens to structurally match a `functional-model/tokens.ts` `TOKENS`
  registry entry back into a `TOKENS.<key>` reference, even though a couple
  of pre-existing hand files do that (cat-collector's own Food token) —
  that DRY choice is a human/AI authoring convention this compiler has no
  concept of, not something "the compiler's own output" can honestly claim;
  every token in the 23 replaced files is now a plain inline literal.
- `author-fdn-definitions.ts` — the real write-to-disk CLI
  (`npx vite-node .../author-fdn-definitions.ts <dirSlug>... | --all-blue`),
  reading `fdn-1-50-cases.ts`'s own `CASES` table, refuses to author a
  non-`blue` case or a dirSlug with no pre-existing `definition.ts`.
  Deliberately does NOT touch `pipeline-status.json`/`justification.json` —
  see "review-status reset" below for why.

## New compiler capability: `TargetMin$0`/`TargetMax$N` -> `selectUpTo`/`applyToBound`

Added per an explicit mid-task user-confirmed correction (Forge's
`TargetMin$`/`TargetMax$` are literal numeric params, not ambiguous text —
same category of deterministic rule as everything else in this compiler).
New branch inside `PutCounter`'s case in `compileAbilityEffects`: requires
`TargetMin$` to be exactly `'0'` (throws otherwise — `selectUpTo` itself
has no separate min, its own semantics ARE "up to max, 0 allowed"),
requires `ValidTgts$`'s bare type to be `creature` (the only real
`Query.source` `combinator.ts`'s `you`/`opponents`/`anyPlayer` builders
support today), builds `you.creaturesInPlay()`/`opponents.creaturesInPlay()`/
`anyPlayer.creaturesInPlay()` keyed off the compiled owner, `.filter(
'excludeSelf')` when `+Other`/`+StrictlyOther` was present, then
`selectUpTo(query, max, 'target', [applyToBound('target', i, putCounter(...))
for i in 0..max-1])` wrapped in a `kind:'program'` `Effect`. `describe` is
generated mechanically (`numberWord()` helper, 0-10 spellout) — verified
BYTE-IDENTICAL to Felidar Savior's own hand-authored describe string.
Verified against Felidar Savior (real card, `fdn-cards/felidar-savior/
definition.ts` already used this exact combinator shape by hand):
`structuralDiff` against the pre-existing hand file showed ONLY the
already-known, expected `Trigger.cause`/name-minting divergence — zero
diffs in the `program`/`selectUpTo`/`applyToBound`/`putCounter` tree
itself. Felidar Savior is now the compiler's 23rd `blue` card (`fdn-1-50-
cases.ts`'s own coverage-summary assertion updated `{gray:28,blue:22}` ->
`{gray:27,blue:23}`).

## The 23 files actually replaced

sire-of-seven-deaths, armasaur-guide, cat-collector, claws-out,
dauntless-veteran, felidar-savior, fleeting-flight, guarded-heir,
helpful-hunter, prideful-parent, raise-the-past, vanguard-seraph,
bigfin-bouncer, clinquant-skymage, elementalist-adept, erudite-wizard,
grappling-kraken, inspiration-from-beyond, kiora-the-rising-tide,
lunar-insight, mischievous-mystic, refute, skyship-buccaneer — every
`fdn-1-50-cases.ts` `blue` case, no more, no less (the 28 `gray` cases and
everything past FDN collector #50 completely untouched — verified via
`git status --porcelain functional-model/fdn-cards/`, exactly 23
`definition.ts` + 14 `justification.json` + 2 unrelated pre-existing
`NOTES.md` diffs from a concurrent session, nothing else).

Known-flagged special cases confirmed handled: Fleeting Flight and
Prideful Parent (both replaced like everyone else, no special-casing
needed). Mischievous Mystic's export typo (`mischiefousMystic`) is FIXED —
`write-fdn-definition.ts` mints the export name from `fdn-1-50-cases.ts`'s
own `exportName` field, which I corrected to `mischievousMystic` (also
fixed the file's own stale "matched as-is, not fixed" doc comment).
Skyship Buccaneer's stale placeholder is FIXED — the compiler's real
`condition:{kind:'attackedThisTurn'}` Raid structure replaced the old
inert `custom` no-op.

## Review-status reset: verified NONE of the 23 were actually `green`

Checked every one of the 23's real `pipeline-status.json` `status` field
BEFORE touching anything: all `blue` except vanguard-seraph/skyship-
buccaneer (`gray`, pre-existing — no `justification.json` at all, both
still `gray` after replacement for the identical reason, no regression).
**Zero were `green`/reviewed** — the task's own framing ("verify it fires
for cards that were previously green") assumed some would be; the honest,
verified finding is that none were, so there's no real `green -> re-review`
transition to observe on this pool today. Deliberately did NOT touch any
`pipeline-status.json` file (not hand-written, not re-derived via
`gate-and-write-status.mjs`) — the task's own explicit instruction was to
rely on `pipeline-status.ts`'s `effectivePipelineStatus` fingerprint check
(computed at READ time off `definition.ts`'s live content) as the one real
"content changed since review" mechanism, which needs zero writes to fire
correctly for any FUTURE card that does get re-authored after being
`green`. Verified `effectivePipelineStatus` for all 23 directly (read-only
script) — 21 `blue`, 2 `gray`, matching the stored files exactly (no drift,
since none were `green` to begin with).

## `justification.json`: real, necessary follow-up fix (14 of the 23 files)

The compiler's own `Trigger.name` minting (`on${Mode}` — e.g.
`onChangesZone`, `onAttacks`, `onDrawn`, `onLifeGained`,
`onAttackersDeclared`) is a KNOWN, documented, expected divergence from a
human's own hand-picked trigger name (`compile-forge-card.ts`'s own
`triggerNameFromMode` doc comment says so explicitly) — but
`justification.json`'s `definitionKeys: [{kind:'trigger', name:'onEnter'}]`
pointers are hard string references into the SAME card's own compiled
`CardDefinition`, verified by `coverage-justification.ts`'s
`unresolvedCoverageReferenceReason`. Replacing `definition.ts` without
updating these would have left 12 of the 23 cards' own coverage-
justification manifests silently, permanently broken (a real authoring
defect, not a stale pipeline-status.json question) — confirmed empirically
via a read-only `validateCardDefinition` dry-run per card BEFORE fixing
anything: 14 came back `failureKind:'incomplete-authoring'` (12 trigger-
name mismatches + fleeting-flight's `effectKind:'putCounter'` ->
`'putCounterTarget'`, matching the pool's own already-documented majority-
convention default). Fixed by hand, per-card, matching the exact new
compiled name (armasaur-guide: onMassAttack->onAttackersDeclared;
cat-collector: onEnter->onChangesZone, onGainLifeFirst->onLifeGained;
dauntless-veteran/kiora-the-rising-tide: onAttack->onAttacks; felidar-
savior/guarded-heir/helpful-hunter/prideful-parent/bigfin-bouncer/kiora-
the-rising-tide: onEnter->onChangesZone; clinquant-skymage: onDraw->
onDrawn; erudite-wizard/mischievous-mystic: onSecondDraw->onDrawn;
grappling-kraken: onLandfall->onChangesZone) — reasoning prose updated
alongside each `definitionKeys` fix, not just the bare pointer. Re-ran the
read-only dry-run after: all 21 cards WITH a `justification.json` now
`ok:true` (would gate clean to `blue` if regated); the 2 without one stay
`incomplete-authoring`/gray, unchanged. Deliberately did NOT persist any
of this to `pipeline-status.json` (see above).

**Bonus finds while fixing the above** (same "false-positive stale claim"
pattern `false-positive-gap-fixes-2026-09-18.md` already documents
elsewhere): armasaur-guide's and erudite-wizard's and grappling-kraken's
own `justification.json` reasoning prose claimed their real triggers were
"name-only" (no real `on` dispatch value) — false even in the OLD
pre-replacement hand files (`git diff` confirmed the OLD files already had
`on:'attackersDeclared'`/`on:'drawNthCardThisTurn'`/`on:'otherPermanentEnters'`
respectively) — fixed the prose to state the truth (not name-only) while
already touching these entries for the rename; NOT a new capacity-gap
discovery, purely a stale-doc-comment correction.

## `CardDetailTabs.vue`/`forgeJsonCompiler.ts` mechanical follow-ups (card-owned files)

Fixed the one remaining stale `scripts/experiments/forge-json-compiler`
path mention in `app/components/CardDetailTabs.vue`'s own doc comment, and
bumped its "widened to N cards" count (23->24, since `SUPPORTED_CARDS` =
`fdn-1-50-cases.ts`'s 23 blue + the separately hardcoded Exemplar of
Light) plus the matching "22"->"23" count in `server/utils/
forgeJsonCompiler.ts`'s own header — both purely mechanical fixes
following directly from this task's own changes, not a `card`-lane
redesign; flagged here rather than silently done in case `card` wants to
review. `server/utils/forgeJsonCompiler.ts`'s `SUPPORTED_CARDS` itself
needed ZERO logic changes (reads `fdn-1-50-cases.ts`'s `CASES` dynamically,
Felidar Savior flows through automatically).

## Verified

`npx vitest run functional-model` — 120/121 files pass, same single
pre-existing Ajani's Pridemate failure (unrelated, `card-interactions
.test.ts`), 1382/1388 tests passing (5 skipped) — matches baseline exactly.
`npm run typecheck` — exact pre-existing 11-diagnostic baseline, zero new.
`fdn-1-50.test.ts` — 52/52 (including the updated `{gray:27,blue:23}`
coverage-summary assertion). Read-only `effectivePipelineStatus`/
`validateCardDefinition` dry-runs per the 23 cards, both described above.

## Open items for a future session

- `write-fdn-definition.ts` never substitutes a `TOKENS.<key>` reference
  even on an exact structural match (deliberate — see above) — cat-
  collector's Food token is now an inline literal instead of `TOKENS.
  c_a_food_sac`, a minor DRY regression, not a correctness one. Worth a
  deliberate follow-up decision (not mine to make unilaterally) if this
  compiler keeps getting used for more of the pool.
- vanguard-seraph/skyship-buccaneer still have no `justification.json` at
  all (pre-existing gap, unrelated to this task, both stay `gray`) — a
  real, worthwhile future authoring task now that both compile cleanly.
- `write-fdn-definition.ts`/`author-fdn-definitions.ts` aren't covered by
  ANY tsc project today (`functional-model/tsconfig.json`'s own `include`
  list never had `scripts/**`, even before this promotion) — same
  pre-existing gap the rest of `functional-model/scripts/` already has,
  not something this task introduced or was asked to fix.
- Forge-verification still needed: none beyond what `fdn-1-50-cases.ts`'s
  own prior authoring pass already did per-card (this task only added the
  `TargetMin$`/`TargetMax$` rule + wrote already-verified compiled output
  to disk, no new Forge-shape claims beyond Felidar Savior's, which was
  cross-checked against its own real `res/cardsfolder/f/felidar_savior.txt`-
  derived JSON already).
- Nothing here was attributed to an `ENGINE_GAPS.md` entry or flagged as a
  new one — this task added compiler CAPABILITY (schema-side), not a new
  engine-runtime gap; the underlying `selectUpTo`/`applyToBound`/
  `otherPermanentEnters`/etc. vocabulary already existed and was already
  covered by prior `engine-support-registry.ts` entries where relevant.
