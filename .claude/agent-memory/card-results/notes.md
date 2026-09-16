# card-results agent notes

First run of this lane (pilot, 2026-09-15/16) — triage-only pass over FIN
collector 51-75 (25 cards). No recognizer/definition.ts edits made; ran
`apply-recognizers.mjs`/`verify-synergy.mjs`/`verify-text-coverage.mjs`/
`verify-annotation-coverage.mjs` (read/regenerate only) and corrected one
stale `progress.json` (`qiqirn-merchant`, see below). Full per-card
findings went back to the orchestrator via `SubagentHandback`; this file
only keeps the reusable, cross-run stuff.

## Script-invocation gotchas (apply to every future run of this lane)

- **`apply-recognizers.mjs` and `verify-synergy.mjs`/`verify-text-coverage.mjs`
  take PLAIN POSITIONAL slug args, not `--slug=<x>`.** `--slug=foo` gets
  treated as a literal (nonexistent) slug and silently "skipped (no
  synergy.json)" — no error, easy to miss. Always call
  `npx tsx functional-model/scripts/apply-recognizers.mjs foo bar baz`
  (space-separated, no flag). Same for `verify-synergy.mjs`. The
  `CARD_RESULTS_QUICKSTART.md` doc's own `--slug=` examples are wrong as
  written — flagged to whoever owns that doc, didn't fix it myself (out of
  this pass's scope, and I don't own that file).
- **`verify-annotation-coverage.mjs` has NO per-slug arg at all** (checked:
  zero `process.argv` reads in the file) — it's full-pool only, but it's
  read-only/cheap, so just run it bare and grep the output for your own
  batch's slugs.
- `verify-text-coverage.mjs` DOES take positional slugs, same convention as
  apply-recognizers/verify-synergy.

## Recurring cross-cutting recognizer gaps found this batch (worth recognizer-lane prioritizing — each spans well beyond this one batch)

- **No `sacrifice-effect-structural` recognizer exists at all** for a bare
  `kind:'sacrifice'` Effect (as opposed to the cost-shaped
  `sacrificeCostNamedType-structural`/self-sac-as-cost family). 17 real
  pool cards use `kind:'sacrifice'` today: gaius-van-baelsar, ahriman,
  quina-qu-gourmet, sephiroth-fabled-soldier-..., midgar-city-of-mako-
  reactor-raid, reno-and-rude, summon-anima, sleep-magic, louisoix-s-
  sacrifice, vayne-s-treachery, kefka-court-mage-..., cornered-by-black-
  mages, zodiark-umbral-god, phantom-train, jecht-reluctant-guardian-...,
  namazu-trader, sidequest-hunt-the-mark-yiazmat-ultimate-mark. Biggest
  single win available in this space.
- **No `discard-effect-structural` recognizer exists** for a bare
  `kind:'discard'` RESOLUTION effect (as opposed to `discardSelfCost-
  structural`, which is cost-shaped only). 17 real cards: adventurer-s-
  airship, emet-selch-unsundered-..., joshua-phoenix-s-dominant-...,
  malboro, locke-cole, rydia-summoner-of-mist, qiqirn-merchant, kefka-
  court-mage-..., formidable-speaker, giott-king-of-the-dwarves, jecht-
  reluctant-guardian-..., poison-the-waters, rook-turret, hecteyes,
  nibelheim-aflame, sidequest-card-collection-magicked-card, summon-g-f-
  ifrit.
- **No `untapTarget`-effect-structural recognizer** for the declarative
  `kind:'untapTarget'` Effect (real, wired since 2026-09-12, magic-damper/
  formidable-speaker both use it) — same shape family as `tapTarget-
  effect-structural`/`putCounterTarget-effect-structural`, just no sibling
  built yet.
- **No `grantKeywordSelf-effect-structural` recognizer** — 3 real cards
  (sahagin, tyvar-the-pummeler, sidequest-hunt-the-mark-yiazmat-ultimate-
  mark) use `kind:'grantKeywordSelf'`, no recognizer reads it at all
  (only `grantKeywordTarget`/`grantKeywordAll` have structural coverage).
- `tapTarget-effect-structural`/`putCounterTarget-effect-structural` both
  permanently decline `validType:'creature-or-artifact'` citing only
  Ring of the Lucii/Omega (whose real text says "nonland permanent", a
  genuinely broader claim) — but **ice-flan's own real text literally
  reads "target artifact or creature"**, a second, narrower, real
  confirmed template these two recognizers don't have yet. Worth adding
  (verified against ice-flan directly, not guessed).
- `grantKeywordTarget-effect-structural` permanently declines jill-shiva-
  s-dominant-shiva-warden-of-ice by name (`keyword:'Unblockable'` backing
  "can't be blocked this turn," a different verb phrase than its own
  "gains X" template family) — real, buildable, single-card template
  today.
- `continuousKeywordGrantsEquipped-structural` permanently declines
  `CantUntap` (sleep-magic) for lack of a single-word template (its real
  rendering is a full-sentence paraphrase) — a literal, fixed-sentence
  special case ("doesn't untap during its controller's untap step") is
  buildable without generalizing the word-substitution machinery.

## Recurring `card.ts`/definition-lane vocabulary gaps found this batch

- **No declarative Effect kind for "create a token that's a copy of a
  chosen target"** (Clone-style) — every real use (`doppelgang`, `sin-
  spira-s-punishment`, `the-fire-crystal`, `relm-s-sketching`) goes
  through `kind:'custom'`, unreadable by any recognizer.
- **No declarative way to chain "the object a prior effect just created"
  into a follow-up conditional effect** — forces `kind:'custom'` on
  `retrieve-the-esper` + 3 siblings (`from-father-to-son`, `the-final-
  days`, `nibelheim-aflame`), all "create a token, then conditionally
  buff THAT token" shape. Good combinator-DSL candidate (per project's
  "combinator DSL is default" convention).
- **No declarative `gainControl` Effect kind at all** — every real use
  (`stolen-uniform`, and per that card's own comment, Stiltzkin/zidane-
  tantalus-thief/unexpected-request) goes through `kind:'custom'`.
- `untapTarget`'s own `validType` union has no `attacking`-filtered
  variant — blocks `sage-s-nouliths`' granted "untap target attacking
  creature" from migrating off `kind:'custom'`.
- `kind:'drawCard'` Effect has no `optional?: boolean` field (unlike
  `destroy`'s own) — blocks `rook-turret`'s "you MAY draw a card" from
  ever being asserted; `drawCard-effect-structural`'s own module comment
  already names this as the one real, permanent, by-design decline.
- `kind:'sacrifice'` Effect's own `validType` union has no `'legendary'`
  filter (only creature/artifact/enchantment/token-or-not) — `louisoix-s-
  sacrifice`'s own Fact is honestly narrowed to Legendary+Creature (the
  Fact should describe real oracle scope even where engine execution is
  narrower — established convention, not a new decision) while the
  engine-side effect stays approximated as `validType:'creature'`.

## Process finding: a stale-duplicate-fact case apply-recognizers.mjs's own self-heal logic doesn't cover

`matoya-archon-elder`'s own `synergy.json` carries TWO `drawCard` facts:
one now correctly retagged with `provenance` by `drawCard-effect-
structural`, and one leftover, unprovenanced duplicate whose annotation
points at the card's own REMINDER-text parenthetical ("Draw after you
scry or surveil.") instead of the real rules-text clause. The existing
self-heal passes (`mergeDuplicateFacts`/`mergeSameRuleExistingFacts`) only
collapse facts that are BOTH already retagged by a recognizer — neither
covers "a recognizer just (re-)confirmed this claim under a fresh
annotation; an old, unprovenanced, wrongly-anchored duplicate of the same
claim is still sitting on disk." Flagged to recognizer lane as a real
`apply-recognizers.mjs` script gap, not something I fixed by hand (this
lane never hand-edits `synergy.json`).

## progress.json corrections made this pass

- `qiqirn-merchant/progress.json`: `knownGaps` was empty despite its own
  `notes` field already fully describing the self-sacrifice-cost-fact gap
  (matches the pre-existing `isSelfSacrificeActivationCostFact` exemption,
  same family as Zack Fair) — added two real entries (the cost-payability
  gap + the cost-reduction-clause text-coverage gap, 52% coverage).
  **`travel-the-overworld/progress.json` has the identical stale/empty
  `knownGaps` for the identical `costReductionPerControlled` shape** —
  out of this batch's scope, not fixed, flagged for whoever picks that
  card up next.

## Open Forge-verification still needed (none blocking, none urgent)

- None of this batch's real oracle-text cross-checks needed a Forge
  script lookup beyond what `data/fin/fin_scryfall.json` already gave
  (every gap found was a recognizer/vocabulary gap, not an oracle-text
  accuracy question) — `forge-lookup.mjs` wasn't actually needed this
  round, kept in reserve per the quickstart's own guidance.

## 2026-09-16: stale self-cast/self-enters(-or-graveyard) baseline-pair cleanup (4 named outliers)

Direct hand-edit task (explicitly sanctioned, not the usual regen-only
workflow — these facts predate `apply-recognizers.mjs` entirely and
nothing regenerates them): removed the old, now-pool-wide-dropped
self-cast/self-enters(-or-graveyard) baseline `Fact` pair from 3 of the 4
named outliers; the 4th (`memories-returning`) turned out to be a
genuinely different shape and was left untouched.

- **`ultima`**: removed `{event:'cast', from:'Hand', target:'self'}` +
  `{to:'Graveyard', controller:'you', subject:'self'}` (both typeLine 0-7
  anchored, no provenance). This card's own `progress.json` had ALREADY
  flagged this exact pair as a stale-convention cleanup candidate in a
  same-day earlier re-triage note — this pass just executed that flag.
  Destroy-all/dies facts and the 5 bystander soft notes (4 `enters`, 5
  `tapForMana`) untouched, byte-identical before/after.
- **`zack-fair`**: removed `{event:'cast', from:'Hand', target:'self'}` +
  `{event:'entersBattlefield', to:'Battlefield', subject:'self',
  target:'self'}` (both typeLine 10-18 anchored, no provenance). The
  REAL, distinct "enters with a +1/+1 counter" fact (oracle-anchored
  `putCounter`) and every other real fact (sacrifice, grantKeyword,
  counter-transfer) is untouched — that one is the genuine CR 614.12
  special case, structurally separate from the plain baseline pair.
  `verifySynergy` bumped `"pass"` -> `"notes"`: removing the hand fact
  surfaces ONE new soft note (`trace has enters (...Zack Fair...) with no
  matching declared produce`) — confirmed via a full-pool grep this is
  the SAME pre-existing, already-widespread soft-note bucket dozens of
  other already-migrated normal-permanent cards carry (Adelbert Steiner,
  Aerith Gainsborough, Al Bhed Salvagers, Cloud Midgar Mercenary, etc.),
  not a new class of problem — `isNormalPermanent`'s own match-time
  synthesis covers the real interaction/graph edges fine, this reverse
  check just isn't wired to see synthetic facts (pre-existing limitation,
  not something this pass introduced or should fix).
- **`esper-origins-summon-esper-maduin`**: removed ONE stale legacy fact,
  `{zone:'Graveyard', controller:'you', subject:'self', face:'front'}` —
  no `cast`-from-Hand counterpart was present to remove alongside it
  (apparently already gone). Notably this fact predated BOTH the
  2026-09-11 `zone`->`to` fold (used the retired `zone` key) AND the
  2026-09-11 required-`annotations` rule (had NO `annotations` field at
  all, unlike every other fact on this card) — a clear leftover, not live
  data. This card's own `progress.json` was separately very stale
  (2026-09-04, predating nearly all the recognizer wiring) — only
  appended a narrow note for this one removal, did NOT attempt a full
  re-triage (out of this task's scope).
- **`memories-returning` — did NOT match, nothing removed.** Its current
  `synergy.json` has no plain self-cast(Hand)/self-graveyard baseline pair
  at all; its facts are the real, distinct Flashback-cast(Graveyard) +
  Flashback-exile pair plus a real Library->Hand dig fact. Its own
  `progress.json`'s 2026-09-12 note documents that a baseline pair WAS
  present then, but it's absent today — almost certainly stripped during
  the later, separate 2026-09-14 `instant-sorcery-resolves-to-graveyard`
  recognizer-retirement pass (card-schema.md's own dated entry: Flashback
  cards keep their real Graveyard-cast/Exile facts, normal Hand-cast now
  covered by match-time synthesis instead). Added a short verification
  note to its own `progress.json` recording this finding so it isn't
  re-flagged as an open outlier again.

**Verification**: `verify-synergy.mjs` on all 4 (0 hard failures, confirmed
byte-identical soft-note output for ultima/esper-origins vs. a git-stash
before/after comparison; zack-fair's 1 new note explained above);
whole-pool `verify-synergy.mjs` (320 checked, 0 hard failures) and
`verify-annotation-coverage.mjs` (clean) both re-run after. `npx vitest
run functional-model`: 821 passed / 1 pre-existing failure
(`dealDamageTarget-effect-structural.test.ts`'s Slash of Light case,
confirmed via stash/pop to fail identically before my edits too — another
concurrent session's own in-flight `slash-of-light` work, unrelated).

No new Forge lookup was needed (this was a pure Fact-removal/provenance
cleanup, not an oracle-text accuracy question) — nothing outstanding to
verify against Forge from this pass.
