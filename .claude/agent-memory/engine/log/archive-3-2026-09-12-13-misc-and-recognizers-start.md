<!-- Raw verbatim chunk of the old engine-agent notes.md (retired 2026-09-18 memory-hub migration). Grep-only archive, not read on spawn. Dates are approximate/best-effort, content is not strictly chronological within a chunk. -->

and it has TWO such sinks (you + opp) rather than one. Narrowing both to
`types:{has:['Creature']}` (correct per the real oracle text) drops every
non-creature match on both sides at once (lands, non-creature Equipment/
Auras, non-permanent spells) — 131 lost, a mix of genuine type-narrowing
losses and same-pair "battlefield presence"->"enters the battlefield"
cosmetic relabelings (the usual `zoneMovementName` rename this pool's
migrations already produce elsewhere). The 56 gained lines are all
genuinely new `enters the battlefield` matches via self-enters'/hero-token-
etb's own new event-shaped vocabulary satisfying other real cards' own
type-constrained wants (Adelbert Steiner, Ambrosia Whiteheart, Clash of the
Eikons, Dion Bahamut's Dominant, and more — spot-checked several, genuine).
No pump/grantType/untap-shaped matches gained or lost pool-wide (nothing
wants those event shapes yet).

**Tooling gotcha worth flagging for future sessions**: an initial attempt at
this same diff was badly corrupted by running a background-writing command
(`find-synergies.mjs > file`) and an immediate `wc -l file` as two separate
tool calls issued together — got a partially-written file's line count
(170/245, coincidentally the SAME as the final correct numbers, which
delayed noticing) followed by a wildly inflated re-read minutes later
(21k+ lines) once the write had actually finished. Redid the whole
measurement from scratch, strictly sequentially within single shell
invocations, confirming file completeness before reading it — got clean,
reproducible -131/+56 both times. Moral: never trust a line count read in
the same batch as the command that produced the file when the underlying
process is not synchronous/instant.

**Open Forge-verification**: none needed — real oracle text confirmed
directly against `data/fin/fin_scryfall.json` (collector_number 70); this
pass is a fact-model/vocabulary migration onto already-correct engine
mechanics (the `onEquippedAttacks` trigger/untap Effect were already
correct pre-migration), not new engine work.

## 2026-09-12 — "Ar" on Restoration Magic's 3rd scenario: real bug, root cause + fix

User-reported "fabricated card name 'Ar'" on fin/30 (Restoration Magic)'s
Curaga scenario. NOT a fabricated name authored anywhere — no literal
`"Ar"` string exists in the repo at all. Real root cause: `harness.ts`'s
`setupPlayer` still had a plain (non-Equipment) `PlayerState.artifactsCount`
battlefield filler that used a synthetic, imageless `${owner}-artifact-${i}`
placeholder name (never upgraded to a real Scryfall identity the way
`GENERIC_FILLER_LAND`/`GENERIC_FILLER_CREATURE` already were) — the
replay UI's own `app/lib/scenarioReplay.ts` `placeholderLabel()` renders
ANY name matching `/-artifact-/` as the 2-letter abbreviation chip `'Ar'`
(parallel to `'Cr'`/`'Ld'`/`'Eq'`/`'En'` for the other still-un-upgraded
buckets) — that abbreviation, not a fabricated card, is what the user saw.
Still a real "scenario replay: real not mocked" violation in spirit (an
imageless synthetic placeholder reads exactly like a fabricated name to
someone just looking at the UI), so fixed for real rather than dismissed:

- Added `GENERIC_FILLER_ARTIFACT = 'Mind Stone'` to `harness.ts` (mirrors
  `GENERIC_FILLER_LAND`/`GENERIC_FILLER_CREATURE`'s own doc-comment
  pattern exactly) and switched the plain-`artifactsCount` battlefield loop
  to use it instead of the synthetic name.
- Regenerated `cards/restoration-magic/trace.json`
  (`npx vite-node functional-model/scripts/run-scenarios.mjs
  --slug=restoration-magic`) — Curaga's log now targets "Mind Stone", not
  the old placeholder. `verify-synergy.mjs restoration-magic` → OK.
  `vitest run functional-model` → 238/238 (includes
  `scenario-card-names.test.ts`, unaffected — see below).
- **Scoped deliberately narrow**: did NOT touch `equipmentCount`,
  `enchantmentsCount`, battlefield `landsCount`, or the graveyard/library
  count buckets — all still use the same kind of synthetic
  `${owner}-<bucket>-${i}` name (and would show their own `'Eq'`/`'En'`/
  `'Ld'`/etc chip if a scenario's replay ever surfaces one). Same latent
  symptom, just not reported yet — fix one at a time as a real scenario
  actually surfaces it, per this exact precedent, not preemptively.
- **Did NOT touch `app/lib/scenarioReplay.ts`** (card/ui lane, not mine) —
  its `seedPlayerCards` is a hand-mirrored copy of `setupPlayer`'s naming
  convention (its own doc comment says so explicitly) and now needs the
  identical follow-up edit (add `GENERIC_FILLER_ARTIFACT` import, change
  its own plain-artifact loop from `push(\`${n}-artifact-${i}\`, ...)` to
  `push(GENERIC_FILLER_ARTIFACT, ...)`) — until that lands, replaying
  restoration-magic's Curaga scenario in the UI will show a real "Mind
  Stone" name in the LOG text but the seeded board chip itself will still
  be the old synthetic placeholder, i.e. name mismatch/broken highlight.
  Flagged to orchestrator to relay to `card` agent, not done here.

**Task 2 — "is there a strict check for fabricated scenario card names?"
Answer: yes, mostly.** `functional-model/scripts/scenario-card-names.mjs`
(`findFabricatedScenarioCardNames`) scans every `cards/<slug>/scenarios.ts`
for literal `addCard(..., {name: '...'})` strings and cross-checks each
against every real Scryfall name in `data/*/*_scryfall.json` (plus basic
lands, always allowed) — non-real names fail. It's wired into the REAL
test suite via `functional-model/scenario-card-names.test.ts` (so it
can't bitrot into a one-off nobody runs — same fate the project's old
`.tmp-check-images.mjs` had, per that file's own header) and also has a
human-readable CLI, `verify-scenario-card-names.mjs`. Ran it standalone
post-fix: `OK — every addCard(...) literal name in every cards/*/
scenarios.ts is a real Scryfall card.`

**The gap**: this check is deliberately scoped to literal `addCard()` name
strings AUTHORED directly in a card's own `scenarios.ts` — it does NOT
scan `harness.ts`'s own shared `setupPlayer()`, which is exactly where
THIS bug's synthetic name actually came from (`artifactsCount` is a
`PlayerState` numeric field, not a literal `addCard()` call in
restoration-magic's own `scenarios.ts`). So the existing check protects
against "an author typed a fake-looking literal card name into a
scenario" (a real, different risk) but not against "a shared numeric
filler bucket in harness.ts hasn't been upgraded to a real identity yet
and its synthetic internal name leaks into the replay UI as an
abbreviation chip" (this bug's actual class). Recommendation if the user
wants that second class covered too (not built — out of scope per task):
a small companion script/test that scans `harness.ts`'s own `setupPlayer`
for `name: \`${n}-...\`` template-literal patterns not backed by a
`GENERIC_FILLER_*` constant, OR — simpler and requires no new tooling —
just keep applying today's precedent (upgrade each bucket to a real
`GENERIC_FILLER_*` identity) reactively as each one surfaces a real
scenario/UI symptom, same as creature/land/now-artifact already got.

**Open Forge-verification**: none — this was a harness/tooling-identity
fix, not an oracle-text/rules-behavior change; Restoration Magic's own
effect modeling is untouched.

## 2026-09-12 — `Fact.keyword?: string` typing gap closed

`card` agent flagged: `Fact` interface never declared `keyword?: string`
even though `grantKeyword` facts write it pool-wide (e.g.
`moogles-valor/synergy.json`'s `"keyword": "Indestructible"`) and
`app/lib/factConditions.ts` consumes it — only reachable before via the
generic untyped-field fallback (`formatUnknown`). Added `keyword?: string`
to `Fact` in `functional-model/synergy.ts`, next to `type`/`counterType`,
same doc-comment style (grantType/grantKeyword are sibling free-form
fields). Purely additive — no matching-logic change, `factsInteract`
already did plain-equality on undeclared fields the same way.

Verified: `npx tsc --noEmit -p functional-model` — same pre-existing
TS5097 (`.ts`-extension import) / TS7016 (`.mjs` declaration) noise as on
clean HEAD (confirmed via stash-compare), nothing new from this edit.
`npx vitest run functional-model` → 238/238 passed.

**Open Forge-verification**: none — pure TS typing addition, no engine
behavior/oracle-text change.

## 2026-09-12 (latest+54) — `graveyardCreatureCount` filler gets the same real-identity upgrade

`card`-lane flagged: `setupPlayer`'s (harness.ts) `graveyardCreatureCount`
loop still seeded a synthetic `${n}-gy-creature-${i}` name — unlike
`GENERIC_FILLER_CREATURE`/`_LAND`/`_ARTIFACT`, which already got a real
Scryfall identity earlier today. Symptom: fin/29 (Phoenix Down) scenario 1
showed a stub "Cr" placeholder chip in the replay UI for its graveyard
filler.

**Fix**: reused `GENERIC_FILLER_CREATURE` ('Grizzly Bears') directly for
the Graveyard-zone bucket too, rather than adding a separate
`GENERIC_FILLER_GRAVEYARD_CREATURE` constant — checked pool-wide first
(grepped `graveyardCreatureCount:` across every `cards/*/scenarios.ts`,
24 real hits after filtering out 3 comment-only false positives:
random-encounter, sorceress-s-schemes, summon-esper-ramuh). No scenario
ever seeds this bucket alongside a battlefield filler creature
(`creaturesCount`/`nontokenCreaturesCount`/`creatureCards`) for the SAME
player in the SAME scenario — the couple of scenarios that use both
buckets at once (cloud-of-darkness, deadly-embrace) split them across
`you` (graveyard) vs `opponents` (battlefield), same "same generic name
reused across different players/zones is fine" precedent
`GENERIC_FILLER_LAND` ('Forest') already established across Hand/Library/
Battlefield for both players. Reuse is also the semantically correct
choice: a reanimation-style effect (e.g. Phoenix Down itself) that moves
this card Graveyard->Battlefield now lands as the SAME identity the other
battlefield fillers already use, instead of an inconsistent second name
appearing next to them.

Changed both `functional-model/harness.ts` (`setupPlayer`'s
`graveyardCreatureCount` loop) and `app/lib/scenarioReplay.ts`
(`seedPlayerCards`'s hand-mirrored copy — MUST stay in sync or a trace's
`moveTo` target name desyncs from what got seeded, producing a phantom
duplicate chip). Also updated `placeholderLabel`'s own doc comment (this
file) since the graveyard-creature case it flagged as unresolved is now
fixed — kept the `-creature-` regex branch only for an older/unmigrated
trace shape.

Regenerated `trace.json` for all 24 affected cards, each via a **scoped**
`run-scenarios.mjs --slug=<slug>` call (not a pool-wide run — today's
known footgun): ardyn-the-usurper, cloud-of-darkness, deadly-embrace,
eden-seat-of-the-sanctum, elixir,
emet-selch-unsundered-hades-sorcerer-of-eld, evil-reawakened,
exdeath-void-warlock-neo-exdeath-dimension-s-end, fight-on,
golbez-crystal-collector, gran-pulse-ochu, ignis-scientia,
ishgard-the-holy-see-faith-grief,
joshua-phoenix-s-dominant-phoenix-warden-of-fire, magic-pot, phoenix-down,
qutrub-forayer, rydia-s-return, rydia-summoner-of-mist,
sin-spira-s-punishment, squall-seed-mercenary, summon-titan,
the-final-days, ultimecia-time-sorceress-ultimecia-omnipotent,
yuna-hope-of-spira.

Verified: `vitest run functional-model` → 238/238 passed.
`verify-synergy.mjs` scoped to the 24 affected slugs → 0 hard failures
(only pre-existing informational "note" lines, same shape as other cards
pool-wide, unrelated to this rename). Full-pool `verify-synergy.mjs` → 8
hard failures, but ALL 8 (cargo-ship, cecil-dark-knight-cecil-redeemed-
paladin, dragoon-s-wyvern, il-mheg-pixie, stiltzkin-moogle-merchant,
the-wind-crystal, white-auracite, zack-fair) belong to cards a concurrent
session was actively editing at the same time (confirmed via `git
status` — those cards' `definition.ts`/`scenarios.ts` were dirty from a
process I wasn't running); none of my 24 affected cards are among them.
Live-verified via Playwright screenshot on http://localhost:3000/app/card/
fin/29 scenario 1: graveyard now shows a real "Grizzly Bears" card-art
chip (×2 grouped), not a "Cr" stub.

**Open Forge-verification**: none — pure test-fixture/harness naming fix,
no oracle-text or engine-behavior change.

## magitek-armor (fin/24): stale trace.json, scenarios.ts already fixed (2026-09-12)

Bug report: fin/24's Scenarios replay showed only a "Start" step. Root
cause was NOT the scenario logic — a concurrent batch-migration session
(running live during this task, same one touching cargo-ship/ardyn-the-
usurper/etc.) had already landed the correct consolidated
`scenarios.ts` (`{ trigger:'onEnter', sequence:[{activate:true}] }` —
ETB creates the 1/1 Hero token, then that Hero really Crews the Armor)
but the checked-in `trace.json` on disk was still the OLD, stale
2-scenario-shape file from before that edit (still real/self-consistent,
just out of date). The dev server actually serves `computeTracesLive`
in DEV (see `server/api/card/[set]/[number].ts`'s own doc comment), so
the live page was already correct by the time I checked — confirmed via
Playwright screenshot at `localhost:3000/app/card/fin/24`: Scenarios tab
shows one scenario, 4 real log rows (trigger → createToken → activate →
animate), step slider `0/4` → `4/4`, board at step 4 shows Magitek Armor
as a 4/4 Artifact Creature next to the 1/1 Hero token. The only actual
stale artifact was the committed `trace.json` (which `card`'s
production/PROD path — not dev — would have served); regenerated via
`npx vite-node functional-model/scripts/run-scenarios.mjs --slug=magitek-armor`
to match. `verify-synergy.mjs magitek-armor` → OK. `vitest run
functional-model` → 238/238. Full-pool `verify-synergy.mjs` shows 8
unrelated hard failures (zack-fair etc.), all from the same concurrent
batch session's in-flight edits, none touching magitek-armor.

**Lesson for future scenarios.ts edits**: `run-scenarios.mjs --slug=X`
must be re-run (not just the source edit) any time `scenarios.ts`
changes, even if the dev server itself doesn't need it (it recomputes
live) — the committed `trace.json` is still real generated output other
consumers (prod build, `card` agent reading it directly per the
contract) rely on being in sync.

**Open Forge-verification**: none — scenarios.ts itself (the Crew-via-
Hero-token consolidation) was already the concurrent session's work, not
mine; I only regenerated stale output to match already-correct source.

## `Constraints.excludeSelf` — "another X" qualifier made visible in the Facts tab (2026-09-12)

Bug: fin/21 G'raha Tia's Dying sink rendered as "yours · (Creature/
Artifact) permanent · once per turn" — the real oracle text is "Whenever
**another** creature or artifact you control dies" (`onOtherPermanentsDie`
in `definition.ts`), and the "another"/non-self qualifier was completely
invisible in the notes column. Grepped `synergy.ts`'s `Constraints`
interface first — no existing `notSelf`/`excludeSelf`/`other` field
(confirmed the closest precedents are `attacking`/`attachedToSelf`/
`equippedBySelf`/`tapped`, none of which are "exclude this exact card").

**Added `Constraints.excludeSelf?: boolean`** (`functional-model/
synergy.ts`, CR 109.5 cited — "another" means "other than this object").
Lives on `Constraints` (which `Fact extends`), so it's usable BOTH nested
under an event fact's `target` (G'raha Tia's shape) AND top-level directly
on a zone-shaped fact (Magitek Infantry's shape, see below) — same
dual-placement precedent the other four Self-suffixed fields already
establish.

**Deliberately NOT wired into `satisfiesConstraints`/`constraintsOf`/
`hasAnyConstraint`/`factsInteract`** — scoped this as a pure DATA/display
fix, same "known, deliberate limitation" bucket the other four fields are
already in, even though (unlike those four, which are genuinely blocked on
missing live-board-state plumbing) this one actually COULD be wired today
without new engine plumbing — `factsInteract` already resolves both sides'
real card identity (`pCard.name`/`wCard.name`, see its own `same-instance`
self-check at the `pe.target === 'self'` branch). Left as a flagged,
buildable-later "future matcher unification" item rather than done here,
because wiring it is a real MATCHING-semantics change requiring its own
pool-wide `find-synergies.mjs` before/after diff per SYNERGY_DESIGN.md's
own discipline — out of scope for what was asked (a display fix), and a
different, separately-reviewable change.

**Rendering** (`app/lib/factConditions.ts`'s `constraintPhrases`):
`excludeSelf` prefixes "another" onto the WHOLE type+noun phrase, not just
the bare noun — "another (Creature/Artifact) permanent", not "(Creature/
Artifact) another permanent" (tried the noun-only version first, a live
test run caught the awkward word order, fixed to prefix the full phrase).
Falls back to "another <noun>" even with no type constraint at all
(Magitek Infantry's case: no `types`, just `excludeSelf` alone). Added to
`HANDLED_OR_LABEL_KEYS` so a top-level `excludeSelf` (zone-shaped facts)
doesn't leak through the generic JSON-fallback loop.

**Applied to 9 cards total**, all real, oracle-text-backed "another X"
clauses — the trigger-name/oracle-text grep the task specified surfaced
all of them, no speculative additions:
- **g-raha-tia** (fin/21) — the reported bug, sink `target.excludeSelf`.
- **magitek-infantry** — sink `to:'Battlefield', types:{has:['Artifact']}`
  top-level `excludeSelf` ("you control another artifact" static P/T
  threshold). Its own `progress.json` notes already correctly reasoned
  that `amount` (and now `excludeSelf`) are never matcher-consulted, so a
  real second copy of this card still self-matches as
  `selfInteractionKind:'second-copy'`, unaffected — `review` was `human`,
  reset to `ai` per the reset-on-content-change rule, with a note
  explaining why.
- **loporrit-scout**, **woodland-weavemaster** — legacy-schema (pre-
  annotations-required) `onOtherCreatureEnters`/`onOtherElfEnters` sinks,
  top-level `types` + `excludeSelf`.
- **ahriman**, **phantom-train**, **reno-and-rude**,
  **sidequest-hunt-the-mark-yiazmat-ultimate-mark** (back-face sink only —
  its front-face sinks are unrelated) — all real "Sacrifice another
  creature or artifact" activation-cost sinks (`zone:'Battlefield',
  types:{hasAny:['Creature','Artifact']}`), cross-checked against the
  engine's own `Effect.notSelf: true` already set on each card's
  `sacrifice` effect in `definition.ts` — strong existing precedent this
  really is "another," not a guess.
- **summon-knights-of-round** — chapter V's `pump`/`putCounter` SOURCE
  facts' own `target.excludeSelf` (nested) AND the matching sink
  (top-level) for "other creatures you control get +2/+2" — same
  `Effect.notSelf: true` cross-check as above.

**Not fixed, deliberately flagged rather than swept**: a broader
`grep -rl "notSelf: true"` across `definition.ts` turned up 16 real cards
total; only the 8 found via the task's own oracle-text/`onOther`-trigger
grep were fixed here. The other ~8 (esper-origins-summon-esper-maduin,
jill-shiva-s-dominant-shiva-warden-of-ice, quina-qu-gourmet,
the-wandering-minstrel, summon-choco-mog, dion-bahamut-s-dominant-bahamut-
warden-of-light, namazu-trader, sephiroth-fabled-soldier-sephiroth-one-
winged-angel, summon-primal-garuda, zodiark-umbral-god, ambrosia-
whiteheart, formidable-speaker) are a real, legitimate follow-up sweep —
explicitly not done this pass per the "don't go overboard" instruction;
each would need its own synergy.json inspected to find which fact(s)
correspond to the `notSelf` effect before adding `excludeSelf`, same
per-card care applied here, not a blind field addition.

**Verification**: `verify-synergy.mjs` scoped to all 9 edited cards — 0
hard failures, only pre-existing unrelated soft notes (tapForMana/untap/
tap/pump lines, none about this change). Full-pool `verify-synergy.mjs` —
8 hard failures (cargo-ship, cecil-dark-knight, dragoon-s-wyvern, il-mheg-
pixie, stiltzkin-moogle-merchant, the-wind-crystal, white-auracite,
zack-fair), none in the edited set — confirmed pre-existing/concurrent-
session noise, not caused by this change. `vitest run functional-model
app/lib` → 306/306 passed (added 3 new real test cases to
`app/lib/factConditions.test.ts` covering the nested-target case, the
top-level-no-type case, and the top-level-with-type case). Live-verified
via the running dev server: `curl localhost:3000/api/card/fin/21` shows
the served sink fact now carries `target.excludeSelf: true`, and running
the real `factConditions()` against that exact served fact object
produces `"yours · another (Creature/Artifact) permanent · once per
turn"` — the "another" qualifier is now visible end-to-end. (No
Playwright/screenshot tool was available in this session; verification
was via the live API response + the real rendering function against that
exact object, not a screenshot.)

**Open Forge-verification**: none blocking — CR 109.5's exact wording
("The word 'another' means 'other than this object.'") is cited from
trained knowledge, not re-checked against a live CR text dump this pass;
worth a quick real-CR-text confirmation next time this file is touched,
but low risk (the concept, not the exact rule number, is what's load-
bearing here). The ~8 other `notSelf: true` cards listed above are the
real, concrete next-sweep candidates if this task resumes.

## 2026-09-12 (latest+55) — Fate of the Sun-Cryst (fin/19): 2 real scenarios for the cost-reduction condition's tapped/untapped branch

User's explicit request: "Let's get a scenario for both cases here
(targets tapped and non-tapped creature)." Real branching (a genuine
board-state condition this card's own text keys off of) justifies 2
scenarios per the standing "more than 1 needs a real reason" bar.

Rewrote `scenarios.ts`: `destroysTappedAttacker` (opponent's real Coeurl
attacks — real 508.1f tap via `pilotDeclareAttackers` during a genuine
turn-passage to the opponent's own Declare Attackers step, NOT a
synthetic `state.tap()` flag flip — then the instant is cast targeting
the now-tapped attacker, legal at any priority window since it's an
Instant) and `destroysUntappedCreature` (same Coeurl, no combat,
genuinely untapped — essentially the prior single scenario, re-commented
for contrast). Gap #7 status unchanged and reconfirmed: `canCastSpell`/
`castSpell` (engine.ts) still have zero cost-reduction hook, `manaCost` is
a fixed printed string — BOTH scenarios pay the full printed {4}{W}
regardless of the real tapped state; only the real TARGETING CONDITION is
demonstrated (true in scenario 1, false in scenario 2), the discount
itself stays documented-only.

Needed `libraryCount:7` on both `you`/opponent in scenario 1's setup
(not previously needed by this card) — the real turn-passage now crosses
two real Draw steps, and hit a genuine 104.3c empty-library-loss
`advance()` throw on the first run without it (a real failure, not
fabricated — fixed by giving both players a real library, not by
routing around the mechanic).

Verified: `verify-synergy.mjs` scoped to this slug → 0 hard failures
(soft notes only: enters/drawCard/tap/attack + tapForMana×5 per scenario
— all real opponent-side/mana-payment actions with no declared-fact
vocabulary, same shape every other engine-piloted scenario takes); full
pool → 8 hard failures, all 8 (cargo-ship,
cecil-dark-knight-cecil-redeemed-paladin, dragoon-s-wyvern, il-mheg-pixie,
stiltzkin-moogle-merchant, the-wind-crystal, white-auracite, zack-fair)
confirmed via `git status` to belong to a concurrent peer session's own
in-flight edits (all 8 dirty from something else already), none of them
this card. `npx vitest run functional-model`: 238/238. Regenerated
`trace.json` via scoped `npx vite-node functional-model/scripts/
run-scenarios.mjs -- --slug=fate-of-the-sun-cryst` (note: needs the
`vite-node` wrapper, not bare `node` — this repo's `.ts`/`.mjs` mix isn't
directly Node-ESM-resolvable). Live-verified via Playwright on
http://localhost:3000/app/card/fin/19: Scenarios tab shows count 2, both
step fully through to resolution in the replay widget (scenario 1's own
action log: Pass turn → Advance to Declare Attackers → Declare Coeurl as
attacker → Cast → Resolve, ending with Coeurl in opp0's graveyard and the
spell in your own graveyard; scenario 2: simpler same-turn cast →
resolve). Facts tab unaffected (the `Constraints.tapped` sink fact
predates this change from earlier today, renders the same as before).
`progress.json`'s `review` was already `"ai"` (no reset needed — this
task never touched already-reviewed content).

**Open Forge-verification**: none new — no oracle-text or fact-vocabulary
change this pass, purely a scenarios.ts real-board-state addition. Gap
#7 (cost-reduction effects have no engine vocabulary at all) remains the
one standing open item this card's own text still can't fully execute.

## 2026-09-12 (latest+56) — Dragoon's Lance (fin/17): new `Scenario.forceCast`, real cast/enters lifecycle instead of the trigger-only shortcut

User's explicit request: "1 scenario is enough, also make it use cast,
not just some mythical enter." Already had exactly 1 scenario (a prior
migration's own consolidation), so the real fix was the second half.

The existing scenario used a top-level `trigger:'onEnter'` — per
`harness.ts`'s own `lifecycleBefore`/`selfZone`, this starts `self`
already on the Battlefield and skips `cast`/`enters` outright (the
"mythical enter" the user meant: the card never gets cast for real, just
materializes already-on-battlefield). Checked the family this task
pointed at (astrologian-s-planisphere/sage-s-nouliths/white-mage-s-staff,
plus paladin-s-arms which their own comments cite as the pattern's
origin): ALL FOUR currently use the identical trigger-only shortcut,
explicitly and correctly documented (their own comments) as a structural
harness.ts limitation, not an authoring oversight — `isActivationCostPermanentBaselineFact`
(verify-synergy.mjs) already says outright: "the harness has no scenario
field that bypasses this branch" for ANY permanent with its own
`activationCost` (this card's Equip {4}). So there was no way to just
restructure dragoon-s-lance's own scenarios.ts to satisfy the user's ask
— the actual fix had to be in shared `harness.ts`.

Added `Scenario.forceCast?: boolean` (harness.ts): lets a scenario opt a
card with `activationCost` back into a genuine `cast`(Hand)->`enters`
(Battlefield) lifecycle. Three call sites gained a `&& !scenario.forceCast`
alongside their existing `card.activationCost` check: `lifecycleBefore`
(emit `cast` not `activate`), the `selfZone` computation in `runScenario`
(start on Stack not Battlefield), and `lifecycleAfter` (emit `enters`).
Fully backward-compatible: every existing scenario in the pool leaves
`forceCast` unset, so `!undefined` is always `true` and old behavior for
every other card is byte-identical (confirmed: full-pool verify-synergy
and vitest below, no new failures anywhere else). Also had to guard the
UNNAMED top-level `resolveCard(effectiveCard, ctx, actions, scenario.trigger,
scenario.ability)` call in `runScenario` itself: when `trigger`/`ability`
are both unset AND `card.activationCost` is set, `resolveCard`'s own
fallback branch runs `card.effects` — which for an Equipment like this
one for game IS the activated Equip ability, never a spell's own cast-
resolution effect (card.ts's documented convention: an activationCost
permanent reserves `card.effects` for its activation, never a cast). Under
the OLD behavior this branch was unreachable in this shape (activationCost
alone already forced the early `activate`-lifecycle return), but under
`forceCast` it would otherwise silently auto-fire the Equip ability for
free the instant the card was "cast" — a real correctness bug, not just a
missing-evidence one. Fixed by skipping that call outright when
`scenario.forceCast && effectiveCard.activationCost` — the real activation
now only fires later via an explicit `sequence` step's `activate:true`,
paying the same real cost-payment semantics the card's printed activation
cost requires.

New dragoon-s-lance scenario: `forceCast:true`, `you:{creaturesCount:1}`,
`sequence:['onEnter', {activate:true}]` — one continuous, real playthrough:
cast from hand -> enters the battlefield -> Job select ETB trigger fires
(creates the 1/1 Hero token, auto-attaches) -> real Equip {4} activation
re-attaches to the OTHER real creature already on the battlefield (a real
vanilla Grizzly Bears, present before the token is created, so it's
`getCreaturesInPlay()`'s own first/default candidate — genuinely
different from the Hero token, not a no-op re-target). Regenerated
`trace.json` (`npx vite-node functional-model/scripts/run-scenarios.mjs
--slug=dragoon-s-lance`) confirms the exact log shape: `cast`, `enters`,
`trigger:onEnter`, `createToken`, `equip`(->Hero), `activate`,
`read:getCreaturesInPlay`, `equip`(->Grizzly Bears) — no double-fired
`activate`, no stray "free" equip before the real activation.

Verified: `node functional-model/scripts/verify-synergy.mjs dragoon-s-lance`
→ OK. Full pool (`node functional-model/scripts/verify-synergy.mjs`, no
slug) → 317 v2 cards checked, 8 hard failures (cargo-ship,
cecil-dark-knight-cecil-redeemed-paladin, dragoon-s-wyvern, il-mheg-pixie,
stiltzkin-moogle-merchant, the-wind-crystal, white-auracite, zack-fair) —
confirmed via `git status --short` every one of those 8 is a file
actively dirty from a concurrent peer session's own in-flight work (none
touched by this task), same "isolate concurrent noise" convention prior
sessions already used. `npx vitest run functional-model`: 238/238
(unchanged). `npx tsc --noEmit`: 0 errors. No Playwright/browser tool was
available in this invocation's toolset — live-verified instead via
`curl localhost:3000/api/card/fin/17` against the already-running dev
server: `functionalModel.traces` is a length-1 array whose single
`log` matches the regenerated `trace.json` byte-for-byte (real
cast->enters->trigger->createToken->equip->activate->equip), confirming
the served payload the card page's Scenarios tab actually consumes now
carries the real lifecycle, not just the on-disk file. Reset
`progress.json`'s `review` from `"human"` back to `"ai"` (authored-content
change — scenario shape/trace changed for real) per the standing
review-reset convention.

Deliberately did NOT retrofit the sibling family (paladin-s-arms,
sage-s-nouliths, white-mage-s-staff, astrologian-s-planisphere) onto the
new `forceCast` mechanism — out of this task's stated scope (dragoon-s-lance
only). They remain correct under the OLD house style (still a real,
accurate trace, just without real cast/enters evidence) and are now
straightforward, low-risk candidates to upgrade the same way in a future
pass — flagged in dragoon-s-lance's own `progress.json` `knownGaps`, not
added to `ENGINE_GAPS.md` (this is a harness/scenario-authoring
infrastructure fix, not a Forge-parity rules gap, so it doesn't fit that
doc's own numbered-gap scope).

**Open Forge-verification**: none — no oracle-text or fact-vocabulary
change this pass, purely a harness.ts scenario-mechanics fix plus a
scenarios.ts rewrite using existing, already-Forge-cited vocabulary
(Job select / Equip {4} were both already verified against the real
Scryfall oracle text in this card's own 2026-09-11/12 (earlier) entries).

## Cloudbound Moogle (fin/11): dropped the self-target ETB scenario, checked Plainscycling as a replacement (2026-09-12)

Direct user ask: if the card keeps 2 scenarios, prefer a real Plainscycling
scenario over the existing 2nd branch (`creaturesCount:0`, ETB counter
falls back onto Cloudbound Moogle itself) — that 2nd branch is a no-op/
edge-case variant of the same trigger, not a genuinely distinct mechanism,
per the user's own standing "2 real distinct branches" rule.

**Checked achievability first, did not assume either way.** Confirmed
Plainscycling has zero real engine-piloted trace mechanism, same
conclusion `engine` reached for Ice Flan's Islandcycling migration
earlier the same day (see that card's own dated entry above, and this
card's own 2026-09-11 "latest+30"/"rollout continuation" entries which
first flagged the gap):
- `harness.ts`'s `ability`/`activationCost` scenario paths both force
  `selfZone` to `'Battlefield'` — there is no from-Hand activation path
  (an activated ability whose own cost is discarding itself FROM HAND,
  before ever being a permanent, has no harness support at all).
- `card.ts`'s `Effect` union has no search/tutor kind (`move`/`dig` are
  the closest, neither models "search library for a card of a type,
  reveal it, put into hand, then shuffle").
- Confirmed via `verify-synergy.mjs`'s own `isCloudboundMoogleDiscardSelfWant`/
  `isCloudboundMoogleTutorFact` exemptions (added 2026-09-11): these exist
  precisely because Plainscycling's discard-as-cost SINK / tutor-for-Plains
  SOURCE facts are real+textually-backed but permanently zero-trace-evidence
  by design — corroborates the same conclusion from the fact-authoring side.

**Result: did not fabricate a 2nd scenario.** Dropped the self-target
branch outright, `scenarios.ts` now has exactly 1 scenario (the real
ETB-with-a-target-creature-present branch), unchanged mechanically from
before — it already carries real `fn:'cast'`/`fn:'enters'` baseline
evidence via the pre-existing no-top-level-`trigger` + `sequence:['onEnter']`
shape (from the 2026-09-11 "latest+33" consolidation). `progress.json`
records the reasoning + resets `review` `"human"`→`"ai"` (authored-content
change). Plainscycling's own SINK/SOURCE facts are untouched.

Regenerated `trace.json` via `run-scenarios.mjs --slug=cloudbound-moogle`
(note: these `.mjs` scripts need `npx tsx <path>`, not plain `node` —
plain `node` fails with `ERR_MODULE_NOT_FOUND` resolving `harness.ts`'s own
`.ts` imports). `verify-synergy.mjs` scoped: OK. Full pool (317 checked):
8 hard failures, all pre-existing/concurrent-peer-session cards per `git
status` (cargo-ship, cecil-dark-knight-cecil-redeemed-paladin,
dragoon-s-wyvern, il-mheg-pixie, stiltzkin-moogle-merchant,
the-wind-crystal, white-auracite, zack-fair) — none this task touched,
none newly introduced. `npx vitest run functional-model`: 238/238.
Live-verified via a one-off Playwright script (repo has `playwright` in
`node_modules` but no wired-in screenshot tool; ran a throwaway `.mjs`
from the repo root, since Node can't resolve bare-specifier imports from
outside the package root, then deleted it) against the running dev
server at `localhost:3000/app/card/fin/11` — Scenarios tab badge reads
"1", single scenario shown: "is cast from hand, enters the battlefield,
then puts a +1/+1 counter on the other creature."

**Open Forge-verification**: none — no oracle-text or new fact-vocabulary
this pass. The one standing open item is the same one already recorded for
Ice Flan/the *cycling family generally: a future task building generic
"activated ability with a discard-this-card cost, searches library"
support (Forge's own generic `TypeCycling`/`Cycling` keywords) should
treat Plainscycling/Islandcycling/Swampcycling/Mountaincycling/
Forestcycling/plain Cycling as one shared design surface, not fix any one
card in isolation.

## 2026-09-12 (later): Cloud, Midgar Mercenary + Ultima Weapon (fin/563) real combo scenario — gap #13 re-assessed, not built

Direct orchestrator/user ask: "let's run the real scenario here. fin 563
could be used to test" (fin/563 = Ultima Weapon, a real Legendary
Equipment: "Whenever equipped creature attacks, destroy target creature an
opponent controls. Equipped creature gets +7/+7. Equip {7}."). Cloud's own
static ("if a triggered ability of Cloud or an Equipment attached to it
triggers, that ability triggers an additional time") is ENGINE_GAPS.md
gap #13 — asked to judge fresh whether it's now worth building a narrow
doubling hook, given the user is specifically asking for the real scenario.

**Re-checked gap #13 fresh, did not just re-cite the old writeup.**
Confirmed it's still NOT a narrow, single-chokepoint fix (unlike STUN/
FINALITY's own counter-replacement pattern, which each intercept exactly
ONE mutation method): `resolveCard()` is invoked from >=6 independent
call sites across this codebase (`stack.ts`, `engine.ts`'s two enter-
trigger dispatch sites, `saga.ts`, `harness.ts`'s scenario runner,
`engine-trace.ts`'s own `pilotFireTrigger` for un-auto-dispatched
triggers) with no single existing chokepoint they all funnel through.
Also confirmed, newly, that this is genuinely not Cloud-specific: grepped
the full pool for "additional time" — The Masamune (dying-trigger-or-
emblem gate) and Traveling Chocobo (land/Bird-ETB-on-any-permanent gate)
need the SAME general mechanism with two MORE, different gating
conditions. **Did not build the doubling** — consistent with both this
fresh assessment and the user's own prior explicit 2026-09-11 call on
this exact card ("don't build it, don't add a source fact").

**Built instead: a real, full engine-piloted combo scenario**
(`cards/cloud-midgar-mercenary/scenarios.ts`, replacing its old
single-ETB-only trace) — imports `ultima-weapon/definition.ts` directly
(reuses the actual modeled card, not a re-authored mirror — unlike
`ultima-origin-of-oblivion`'s own local `adventurersInnManaAbility`
mirror, which exists for a DIFFERENT reason: Adventurer's Inn's own real
card genuinely has no modeled mana-ability Effect to reuse at all; Ultima
Weapon does, so direct reuse is the more-real choice here). Sequence: cast
Cloud ({W}{W}) -> real ETB tutors the real Ultima Weapon (seeded directly
into library via `addCard`, not the generic `libraryArtifactCount`
placeholder) into hand -> cast Ultima Weapon for real ({7}) -> real turn
pass (`advanceToPlayersNextMain1` — lands untap, Cloud's 302.6 sickness
clears) -> Equip {7} for real (`pilotActivate`+`pilotResolveTop`, real
`actions.equip`) attaches it to Cloud -> real 508.1f attack declaration
-> Ultima Weapon's own real `onEquippedAttacks` trigger fires via the
pre-existing `pilotFireTrigger` (no attack-trigger auto-dispatch exists
anywhere in this engine — a separate, already-accepted gap every attack-
triggered card hits, not new) -> ONE real `destroy` against a real
opponent creature (Coeurl, reused from summon-bahamut/fate-of-the-sun-
cryst's own precedent as a real non-token destroy target). 9 Plains cover
{W}{W}+{7}+{7} across 2 turns (colored mana pays generic fine, confirmed
via `mana.ts`'s own `canAfford`). No fabricated second destroy anywhere —
checked the produced trace.json by hand.

**Real, good side effect on verify-synergy.mjs**: this is the first trace
in the pool where an ATTACHED Equipment's own triggered ability genuinely
fires while attached, which directly falsifies `isCloudEquipmentTriggeredAbilityFact`'s
own prior claim ("ZERO possible evidence... nor should one be fabricated
just to manufacture evidence") for Cloud's own equipment-half
`triggeredAbility` want fact (`target:{types:{has:['Equipment']},
attachedToSelf:true}`). Added a real evidence branch: a real `equip`
bracket naming `cardName` as target, followed anywhere later (trace order)
by a real `trigger` bracket naming that SAME equipment by name, now counts
as genuine evidence — narrowly shaped, can't false-positive on an
unrelated earlier same-named coincidence. Kept
`isCloudEquipmentTriggeredAbilityFact` itself as a fallback (a future
retrace could lose this evidence again) but corrected its doc comment to
stop claiming zero evidence is possible — a stale claim now that real
evidence exists. Also added `isCloudUltimaWeaponComboRead`, a narrow,
name-gated reverse-check exemption for Ultima Weapon's OWN two incidental
Battlefield reads that now show up in Cloud's own trace (its equip-target
search over `getCreaturesInPlay`, its destroy-effect's own
`getCardsIn('Battlefield')` opponent search) — these are Ultima Weapon's
own oracle-text conditions, not Cloud's, so no Cloud-side Battlefield want
fact was fabricated to explain them away.

**Verification**: `run-scenarios.mjs --slug=cloud-midgar-mercenary`
regenerated trace.json (1 scenario, engine-piloted). `verify-synergy.mjs`
scoped to both cards: 0 hard failures (only pre-existing tolerated soft
notes — tapForMana/untap/drawCard/tap/attack/destroy, all already-parked
classes). Full pool: 8 hard failures, confirmed pre-existing/unrelated —
both new verify-synergy.mjs additions this pass are gated strictly by
`card.name === 'Cloud, Midgar Mercenary'`/the `attachedToSelf` field
(grepped: only Cloud's own synergy.json uses it pool-wide), so neither
change can reach any other card's result; the 8 failures pre-date this
task (concurrent peer work per `git status` at task start, same as
several recent entries above). `vitest run functional-model`: passed both
before (238/238) and after (243/243 — the +5 are concurrent peer-session
tests, not mine). Live-verified via a throwaway root-level Playwright
script (same "can't resolve bare imports from outside the package root"
constraint noted in earlier entries) against `localhost:3000/app/card/
fin/10`: replay plays through all 11 steps with no console errors, ends
with Coeurl genuinely moved to the opponent's Graveyard and the action
log showing `trigger`(Ultima Weapon, onEquippedAttacks) ->
`destroy`(Coeurl) exactly once.

Updated `progress.json` for both cards (cloud-midgar-mercenary's own
`knownGaps` entry corrected to reflect the equipment-half fact's changed
evidence status; ultima-weapon's own notes cross-reference the reuse,
its own facts/trace.json untouched) and `ENGINE_GAPS.md` gap #13 (appended
the fresh 2026-09-12 re-assessment + the 3-card confirmation + the
real-scenario/evidence outcome, did not delete or rewrite the original
writeup).

**Open Forge-verification**: none new — Ultima Weapon's own oracle text/
`onEquippedAttacks` trigger and Cloud's own tutor were already Forge-cited
in earlier passes; nothing in this pass added new fact vocabulary that
needs a fresh citation. Gap #13's own doubling mechanism remains the one
standing item, now confirmed (not just asserted) to need general,
multi-call-site trigger-dispatch infrastructure — worth building only if
a future task specifically commits to that broader lift across all 3
real cards that need it (Cloud, The Masamune, Traveling Chocobo), not
scoped to any one of them.

## 2026-09-12 (latest+56) — Dion, Bahamut's Dominant (fin/16) live regression report: Knight token showing Flying permanently, even during opponent's turn — real root cause was NOT `continuousKeywordGrants`

User/orchestrator report assumed this morning's `continuousKeywordGrants`
turn-toggle mechanism (gap #14) had regressed. **Live-verified it has NOT**
— stepped fin/16 through the browser (Playwright) before touching
anything: Dion's own front-face "Dragonfire Dive" grant correctly reads 2
Flying icons on your turn (Dion + Knight token), 0 on the opponent's turn,
exactly as designed. Real root cause was a DIFFERENT, adjacent mechanism:
Bahamut's own BACK-FACE "Wings of Light — those creatures gain flying
UNTIL END OF TURN" (chapters I/II) had been wired (earlier today, same
batch of edits) to a real `grantKeywordAll` effect — but this pool's
`grantKeyword`/`grantKeywordAll`/`grantKeywordTarget`/`grantKeywordSelf`
have ALWAYS treated a grant as PERMANENT-within-scenario (`state.ts`'s own
long-standing, explicitly-agreed-in-conversation simplification, cited in
~10 other cards' own comments: zack-fair, summon-primal-garuda, etc. —
`turn.ts`'s own file header explicitly deferred the "until end of turn
effects end" half of 514.2 Cleanup). That was harmless everywhere else
because no other card's own scenario ever crossed enough REAL turns past
the grant for it to visibly matter — Dion's is the first real multi-turn
engine-piloted scenario that both uses an "until end of turn" grant AND
keeps stepping through several more turns afterward, so the Knight token
visibly kept Flying through the opponent's own subsequent turns forever,
looking identical to (and getting misdiagnosed as) a `continuousKeywordGrants`
regression.

**Fix implemented** (closes the real, previously-deferred 514.2 half,
opt-in only — every other pool card's existing grantKeyword* call is
UNCHANGED unless it explicitly sets the new flag):
- `card.ts`: new `untilEndOfTurn?: boolean` field on `grantKeywordTarget`/
  `grantKeywordAll`/`grantKeywordSelf`, passed through to `actions.grantKeyword`.
- `interfaces.ts`: `grantKeyword(target, keyword, opts?: {untilEndOfTurn?})`.
- `state.ts`: new `GameState.untilEndOfTurnKeywordGrants: {cardId,keyword}[]`;
  `grantKeyword` pushes onto it when `opts.untilEndOfTurn`; new
  `clearUntilEndOfTurnKeywordGrants()` (real mutation — splices the
  keyword back out of `card.keywords`, game-wide, same scope
  `clearAllDamage` already uses for 514.2's damage half).
- `turn.ts`: `runPhaseEntryAction`'s Cleanup branch now also calls
  `state.clearUntilEndOfTurnKeywordGrants()` alongside the pre-existing
  `clearAllDamage()`; file header comment updated (no longer claims the
  "until end of turn effects end" half is unimplemented — it's now real
  for any OPTED-IN grant; `layers.ts`'s own broader duration-not-tracked
  simplification for every non-keyword "until end of turn" effect shape
  is unchanged).
- `engine-trace.ts`: `PreAdvanceSnapshot`/`snapshotBeforeAdvance` now also
  captures `untilEndOfTurnGrants` before each `advance()` call;
  `logAutomaticPhaseEntry`'s Cleanup branch diffs it against the real
  post-advance `card.keywords` and synthesizes a `{fn:'grantKeyword',
  ..., removed:true}` log entry per pair actually gone — same "diff
  real before/after state" pattern untap/drawCard/discard already use at
  this exact chokepoint. This is a NEW discrete log shape (previous
  `continuousKeywordGrants` work deliberately had NONE, since that's
  query-time-only) — additive field (`removed`), only ever present when
  true.
- `harness.ts`: `loggingActions.grantKeyword` forwards `opts` through to
  `state.grantKeyword` and logs `untilEndOfTurn`/`removed` (additive).
- `dion-bahamut-s-dominant-.../definition.ts`: both chapter I/II
  `grantKeywordAll` effects now set `untilEndOfTurn: true`.
- **Cross-lane touch, flagged not hidden**: `app/lib/scenarioReplay.ts`'s
  `grantKeyword` case (owned by `card`) needed a matching one-line
  consumer update (`entry.removed` → `keywords.delete` instead of `.add`)
  — the trace-log schema change is meaningless without it, same
  precedent this exact engine session set for `continuousGrantedKeywords()`
  itself (also written directly into `ScenarioReplayTrace.vue` by a prior
  engine-agent pass, per this file's own earlier entries). `card` agent
  should be aware `app/lib/scenarioReplay.ts`/`scenarioReplay.test.ts`
  were touched this pass.
- `.claude/contracts/state-event-format.md`: new dated section documenting
  `grantKeyword`'s `untilEndOfTurn`/`removed` additive fields and the "no
  discrete un-grant without crossing a real Cleanup entry" consumer
  contract.
- Tests added: `state.test.ts` (4 new — plain grant persists,
  `untilEndOfTurn` expires at Cleanup, game-wide not just active player,
  drains its own pending list), `turn.test.ts` (1 new, mirroring the
  existing `clearAllDamage` 514.2 test shape), `app/lib/scenarioReplay.test.ts`
  (1 new, add-then-remove consumer round-trip).
- Verified: regenerated `trace.json` (`run-scenarios.mjs --slug=...`) —
  new `{removed:true}` entries land exactly where expected (right before
  each Cleanup crossing). `verify-synergy.mjs` scoped to this card: 0 hard
  failures (same pre-existing soft notes as before, no new ones re:
  `grantKeyword removed:true` — evidence-matching already tolerates it).
  Full pool: 8-9 hard failures throughout this session, ALL confirmed via
  `git status` to be concurrent peer-session dirty cards (cargo-ship,
  cecil-dark-knight, cloud-midgar-mercenary, dragoon-s-wyvern,
  il-mheg-pixie, stiltzkin-moogle-merchant, the-wind-crystal,
  white-auracite, zack-fair — none touched by this pass, count churned
  8↔9 between runs as those sessions kept editing). `npx vitest run
  functional-model app/lib`: 312/312. `tsc --noEmit -p
  functional-model/tsconfig.json`: 47 errors (was 45 in an earlier
  session's own baseline note) — checked every new one is the same
  pre-existing TS5097 `.ts`-import class on OTHER concurrently-edited
  cards, zero in any file this pass touched.
  **Live-verified in the running dev server via Playwright**, stepping
  fin/16's own real scenario at raw sub-action granularity (not just the
  coarse action list): Knight token's Flying icon count goes 1→2 the
  instant chapter I's `grantKeyword` fires (Bahamut's own permanent
  printed Flying + the fresh grant), then back to 1 the very next raw log
  row (the synthesized `removed:true` entry) — and stays at 1 (Bahamut's
  own printed Flying only, never the Knight's) through every subsequent
  opponent-turn snapshot for the rest of the scenario. Confirmed
  Dion's OWN front-face Dragonfire Dive toggle (2↔0 across turns 1-2)
  is completely unaffected/still correct throughout.

**Open Forge-verification**: none new beyond what gap #14's own original
closure already cited — `Card.addChangedCardKeywords`'s real
duration-scoped/timestamped layer-6 behavior (interfaces.ts's own
`grantKeyword` doc comment already cites `Card.java` ~line 5017) is the
real mechanism this fix moves one step closer to for the specific
"until end of turn" case; CR 514.2's own wording ("all... effects...
that say 'until end of turn'... end") was cited from trained knowledge,
worth a live CR-text re-check next time this exact rule number is
load-bearing again, but low risk (same standing as the "another"

## 2026-09-12 — Gaelicat (fin/22): "no artifacts visible" bug, real cause + fix

User-reported bug: fin/22's Scenarios-tab replay showed no artifacts on the
battlefield despite Gaelicat's own real condition ("As long as you control
two or more artifacts, this creature gets +2/+0") and despite the
same-day migration's scenario claiming 2 real artifacts present.

**Root cause** (neither of the two hypotheses the dispatch suggested):
the scenario correctly seeds 2 REAL named fin Artifacts (Phoenix Down,
Elixir, real Scryfall cards, `types: ['Artifact']`) via
`pilot.state.addCard(pilot.you, 'Battlefield', ...)` — not the
Restoration Magic/`GENERIC_FILLER_ARTIFACT` bug at all (that was a
synthetic-name-vs-real-card mismatch on the numeric `PlayerState.artifactsCount`
path; Gaelicat's scenario never used `artifactsCount`). The real bug: a
bystander permanent placed directly via `addCard` needs a matching manual
`pilot.log.push({ fn: 'enters', card: ..., zone: 'Battlefield' })` right
after — `app/lib/scenarioReplay.ts` only ever seeds a card from a real log
entry that names it; this scenario's later `read:isArtifact` entries alone
register the bystander in the 'Unknown' zone (the `read:*` fallback case's
`ensure(target)`, default-zone 'Unknown', not 'Battlefield'), which the
board's render filter skips entirely. This exact convention was already
established and documented in aerith-gainsborough/scenarios.ts's own
header comment ("A real `enters` entry for each bystander — without one,
it never shows up on the replay board at all") — gaelicat's own scenario,
authored the same day, simply hadn't followed it. A real scenario-
authoring gap, not a synthetic-filler-naming gap and not an engine-
behavior gap; the underlying threshold-CDA gap itself (no `ptFormula`
variant for a fixed on/off threshold) is untouched.

**Fix**: added the 2 missing `enters` log pushes in
`functional-model/cards/gaelicat/scenarios.ts`, right after
`phoenixDown`/`elixir` are placed. Regenerated `trace.json` via
`run-scenarios.mjs --slug=gaelicat`.

**Concurrent-session note**: mid-task, `scenarios.ts` changed on disk
under me (a second session trimming redundant "real" wording in the
`result` string, e.g. "2 real Artifacts" → "2 Artifacts") — my own
`enters`-push edit was untouched/intact, so nothing to redo, but I
re-ran `run-scenarios.mjs --slug=gaelicat` a second time afterward so
`trace.json` matches the now-current `scenarios.ts`, not my earlier
snapshot. A live reminder that this card folder had genuine two-session
overlap during this task — worth the orchestrator knowing if it dispatches
another gaelicat task soon.

**Verified**: `verify-synergy.mjs gaelicat` — 0 hard failures (only the
pre-existing benign `tapForMana` soft note), rerun again after the
trace.json regen above, same result. Full-pool `verify-synergy.mjs`: 8
hard FAILs, all pre-existing/unrelated (cargo-ship,
cecil-dark-knight-cecil-redeemed-paladin, dragoon-s-wyvern, il-mheg-pixie,
stiltzkin-moogle-merchant, the-wind-crystal, white-auracite, zack-fair —
all already dirty in `git status` from concurrent sessions before this
task started; gaelicat itself is a soft `note`, never a `FAIL`).
`vitest run functional-model`: 243/243 passed. Live-verified with a
Playwright script driven at the running dev server (localhost:3000):
`/app/card/fin/22`'s Scenarios tab, stepping to action 1 now shows Phoenix
Down and Elixir as real card chips (their own real Scryfall art) on the
battlefield alongside the 3 Plains — confirmed fixed. `progress.json`
`review` reset to `"ai"` (authored-content change to scenarios.ts/
trace.json), with a dated follow-up note explaining root cause/fix
prepended ahead of the original migration note (kept verbatim for
history).

**Open Forge-verification**: none — this was a scenario-authoring/replay-
rendering bug, not an engine-behavior or Forge-sourced-rule question. The
underlying gap (no threshold-gated `ptFormula` CDA variant) remains
exactly as previously documented/exempted; nothing new to verify there.
CR-109.5 note two entries up).

## Pool-wide sweep: scenario `result` text — no "real"/"genuine"/"actual" emphasis (2026-09-12)

New standing style rule, user-driven, scoped ONLY to the literal `result:`
string field of each `Scenario` object in `cards/*/scenarios.ts` — the
user-facing prose shown in the card page's Scenarios tab. Every scenario
already IS real by construction (plays out on the actual engine, setup
just loads specific state) — that emphasis word doesn't belong in text a
user reads, only in engineering comments/notes where it means something
different (verification rigor, not narrative emphasis). Documented as a
new dated section in `SYNERGY_DESIGN.md` (search "no emphasis" or the
2026-09-12 date) so future scenario-authoring passes don't reintroduce it.

**Scope discipline applied**: `finishEnginePilotTrace(pilot, setup, action,
result)`'s 3rd arg (`action`, e.g. `'real engine playthrough: cast ->
...'`) is NOT part of the `Scenario` object (`raw: Scenario = { result,
...setup }` — only `result` lands on it) — it's a separate internal label
shown in the replay UI under `action:`, not `result:`. Left those
UNTOUCHED, on purpose, per the task's explicit scope (only the `result:`
field). Also untouched: every code comment, `progress.json` `knownGaps`,
this file's own prose — all legitimate uses of "real"/"genuine" as an
engineering-rigor claim, different audience/purpose from user-facing text.

**Sweep mechanics**: `result:` strings are NOT all on the object-literal
`result: '...'` shape — many (mostly the newer `EnginePilotSetup`-driven
saga/trigger cards) use `const result = '...'; return
finishEnginePilotTrace(..., result)` instead, sometimes with the key and
the opening quote on different source lines. A naive same-line grep for
`result:` + the target words undercounts badly (found only 16 hits that
way) — had to parse the file content directly (matched
`result:\s*|const result\s*=\s*` followed by tracking the quoted string to
its real closing quote, handling backslash-escaped embedded quotes) to
find all 68 real hits across 61 files. Re-ran the same extraction after
finishing to confirm 0 remaining matches pool-wide (one card,
`machinist-s-arsenal`, had to be caught in a second pass — it wasn't in
the original snapshot, apparently landed via a concurrent peer session
between the first grep and the edit pass; fixed identically to its
sibling Equip-recast cards).

**Editing approach**: mechanical but NOT blind regex-replace — each hit
was read in context and hand-rewritten to stay grammatical (e.g. "taps for
{C} (a real restricted mana ability...)" → "(a restricted mana ability
...)"; "dies in genuine lethal combat" → "dies in lethal combat"; a few
needed a different word entirely to stay natural rather than a bare
deletion — "real text" → "printed text" (gigantoad, summon-fenrir, ultima),
"to actually match" → "to match" (the ~6 land-filler-gap cards sharing
that exact clause), "is real but has no scenario evidence" → "has no
scenario evidence" (white-auracite, dropped the clause rather than
awkwardly rewording it). No underlying fact/scenario LOGIC changed
anywhere — pure text polish on the `result` string values only; nothing
else in any of these files was touched.

**Verified**: `npx vitest run functional-model` → 243/243 (was passing
before too; a pure prose change was expected to be a no-op here). `npx tsc
--noEmit -p functional-model/tsconfig.json` → same pre-existing TS5097
baseline class only (`.ts`-extension imports on other, untouched cards),
nothing new. Did NOT regenerate any `trace.json` or re-run
`verify-synergy.mjs` per the task's own explicit instruction (text-only
change, doesn't touch matching-relevant data) — flagging this here in case
a future pass assumes trace.json is already current for these 61 cards
after today's edit; it is (unaffected), just never re-run as part of this
task.

**Open Forge-verification**: none — pure prose/style pass, no rules
content changed.

## Machinist's Arsenal (fin/23): scenarios.ts consolidated 2 -> 1 (2026-09-12)

User's explicit request: "1st scen is enough" — drop any additional
scenarios. Bare-dropping the old second scenario (`{ result: 'attaches to
a creature you control', you: { creaturesCount: 2, artifactsCount: 1 } }`)
produced a real verify-synergy.mjs hard failure: `want {zone:Battlefield}
has no read:getCardsIn/getCreaturesInPlay/...`. The sink `{to:'Battlefield',
controller:'you', types:{has:['Creature']}}` (wants a creature you
control, for the Equip target) specifically requires a
`read:getCreaturesInPlay` trace line — the Job-select trigger's own Hero
token creation is a real creature entering the battlefield but doesn't
satisfy that specific check; only the Equip {4} activation's own
`chooseTarget(ctx.you.getCreaturesInPlay())` call does. Fixed the same way
paladin-s-arms/sage-s-nouliths/white-mage-s-staff's own 2026-09-12
consolidations already did: chained the real Equip {4} activation onto
the SAME scenario via `sequence:[{activate:true}]` rather than
reintroducing a second scenario — `trigger:'onEnter'` (Job select creates
the Hero token, auto-attaches, and correctly skips the automatic top-level
`activate` this card's own `activationCost` would otherwise force),
`you:{creaturesCount:1}` (a real Grizzly Bears present before the Hero
token exists, so it's `getCreaturesInPlay()`'s own first/default
candidate — a genuinely different re-equip target, not a no-op).

The dropped scenario's own `artifactsCount:1` setup demonstrated nothing
real either way — the per-artifact-count SCALING factor on the static
pump clause (`Equipped creature gets +2/+2 for each artifact you
control...`) has no live-recalculated CDA/layer-7c pipeline anywhere in
this model (already documented in `definition.ts`'s own comment and
`progress.json`'s first `knownGaps` entry), so varying the artifact count
was never real trace evidence for anything. Documented as a "no real
demonstration lost" simplification in `progress.json`'s `knownGaps`
(2nd entry) rather than silently dropped, per the task's own instruction.

Reset `progress.json`'s `review` from `"human"` back to `"ai"` (authored-
content change — scenario shape/trace changed for real).

**Concurrent-edit note**: mid-task, a peer session's own apparent
pool-wide wording cleanup touched this exact file after I wrote it —
`scenarios.ts`'s `result` string changed from my own "a real Equip {4}
activation re-attaches..." to "an Equip {4} activation re-attaches..."
(same "real " → "" trim also visible in paladin-s-arms/sage-s-nouliths'
own scenarios.ts at the same time). Cosmetic only (no functional/shape
change) — accepted it (per the standing "file changed on disk mid-task,
that's usually deliberate" convention) and regenerated `trace.json` to
match rather than reverting.

**Own mistake, flagged not hidden**: an earlier `rm -f` cleanup command in
this same task accidentally deleted `gaelicat-check-tmp.mjs`, an
untracked scratch file at repo root that belonged to a concurrent peer
session (present in `git status --short` before this task touched
anything, not created by this task). It was untracked, so it's
unrecoverable via git — flagged to the orchestrator so the owning peer
session can be told if it still needs that file.

Verified: `node functional-model/scripts/verify-synergy.mjs
machinist-s-arsenal` → OK. Full pool → 317 v2 cards checked, 8 hard
failures, all confirmed via `git status --short` to be pre-existing
concurrent-session dirty cards (cargo-ship,
cecil-dark-knight-cecil-redeemed-paladin, dragoon-s-wyvern,
il-mheg-pixie, stiltzkin-moogle-merchant, the-wind-crystal,
white-auracite, zack-fair), none touched by this task. `npx vitest run
functional-model`: 243/243 passed. Live-verified via a throwaway
Playwright script against the already-running dev server
(`localhost:3000/app/card/fin/23`): Scenarios tab count reads exactly
"Scenarios1", and the single scenario's result text is the chained
Job-select+Equip-activation one. `curl localhost:3000/api/card/fin/23`
also confirms `functionalModel.traces` is a length-1 array.

**Open Forge-verification**: none — no oracle-text or fact-vocabulary
change this pass, purely a scenarios.ts/harness-mechanics consolidation
using already-established, already-Forge-cited vocabulary.

## Magitek Infantry (fin/25): CDA-pump display confirmed known gap; found+partially fixed a real self/duplicate replay-identity-merge bug (2026-09-12)

Two separate questions in one bug report ("displayed as 1/1 with no
+1/+0" + "also it becomes tapped? doesn't make sense").

**1/1 display**: correct/expected, not a bug. `pt:[1,1]` matches the real
printed P/T (Scryfall #25); the +1/+0 "as long as you control another
artifact" clause is the same documented threshold-CDA gap as Gaelicat/
You're Not Alone/Snow Villiers — no live-recalculated CDA/layer-7c
pipeline anywhere in this model, `progress.json`'s own `knownGaps` and
`definition.ts`'s own comment already say so plainly, `scenarios.ts`'s own
`result:` text is honest about it too ("static +1/+0 condition is
text-only, no threshold-CDA engine hook"). No fabricated fix attempted.

**"It becomes tapped" — a REAL bug, found and half-fixed**: confirmed via
a direct `replayTrace()` probe (not just reading code) that the tutored
SECOND copy's own `moveTo`+`tap` (a real, distinct object) visibly merges
onto the ALREADY-on-battlefield ORIGINAL Magitek Infantry chip instead of
rendering as its own separate, correctly-tapped card — so the replay
looked like the original permanent itself flipped tapped, which is why
the user found it nonsensical. Root cause: `app/lib/scenarioReplay.ts`'s
self-identity tracking (`ensureSelf`/`instanceCards`, keyed off harness.ts's
scenario-domain `instanceId`) and its real-object tracking (`resolveInstance`/
`idCards`/`claimedByOtherId`, keyed off `RealCard.id`) are two disconnected
systems — self was never registered into the `id`-keyed one, because
harness.ts's own `cast`/`activate`/`trigger`/`enters` entries never carried
a real `id`, only `instanceId`. Fixed the ENGINE half (my own lane,
`harness.ts`): `lifecycleBefore`/`lifecycleAfter` (+ the `sequence`-step
trigger/activate pushes) now also emit `id: selfReal.id` on every
self-identifying entry, additive alongside `instanceId` — required
reordering `runScenario` so `selfReal`/`state.addCard` happens BEFORE
`lifecycleBefore` is called (used to be the reverse; confirmed safe,
nothing before that point ever pushed to `log`). Documented in
`.claude/contracts/state-event-format.md` (new dated section). Confirmed
in the regenerated trace.json: `activate` now carries `id:6` (self) vs the
tutored copy's own `moveTo`/`tap` `id:3` — genuinely different real
objects, finally distinguishable.

This is INERT on its own — `app/lib/scenarioReplay.ts` (card agent's file,
out of engine's lane) still needs its own consumer-side fix: register
self's resolved `id` into `idCards`/`claimedByOtherId` inside `ensureSelf`
so a later `moveTo`/`tap` with a genuinely different `id` creates a new
chip instead of aliasing through `ensure`'s name-only `byName` lookup.
Flagged clearly in this card's own `progress.json` `knownGaps` + reported
to orchestrator as "needs card agent." Did NOT touch `engine-trace.ts`'s
own matching `cast`/`activate`/`trigger`/`enters` pushes (same gap exists
there, not touched this pass — real follow-up, magitek-infantry itself
doesn't use the engine-piloted path so it wasn't required here).

Did NOT trim the scenario to drop the tutor ability (orchestrator raised
this as an option) — its own `result:` text is already fully honest, the
tutor is the card's other real distinct mechanic worth its own coverage,
and this exact merge-bug class will recur on any other "find another copy
of yourself" card regardless of whether this one keeps demonstrating it;
per this project's own standing "fix/document a real bug a scenario
surfaces, don't curate the board to avoid exposing it" convention, kept it.

Also found+fixed unrelated staleness: this card's own checked-in
`trace.json` on disk still had the OLD 3-scenario shape (from before a
same-day earlier "trimmed to 1 scenario" edit landed in `scenarios.ts`) —
never regenerated after that edit. Regenerated via `run-scenarios.mjs
--slug=magitek-infantry` (now matches the current 1-scenario `scenarios.ts`)
and rebuilt `data/functional-model/fm-bundle.json` (`vite-node
scripts/build-fm-bundle.mjs`) so the live dev server actually serves it.

Verified: `npx vitest run functional-model` (243/243) and `npx vitest run
app/lib/scenarioReplay.test.ts` (22/22) both pass unchanged — the new `id`
field is additive/inert for every existing consumer. `verify-synergy.mjs
magitek-infantry` — 0 hard failures (one pre-existing informational
`note`, unrelated to this change). Live-verified via Playwright against
the running dev server (`localhost:3000/app/card/fin/25`, Scenarios tab,
stepped to the final snapshot): confirms only ONE Magitek Infantry chip
renders (tapped) — i.e. confirms the merge bug is real and still visible,
exactly as diagnosed, pending card agent's own consumer-side fix.

**Open Forge-verification**: none needed — no oracle-text/vocabulary
change, a trace-log-shape addition + a scenario staleness fix. Did NOT
regenerate the rest of the corpus's `trace.json` files to backfill the
new `id` field project-wide (large blast radius, unrequested this pass) —
flagged as a reasonable follow-up once card agent's own consumer fix
lands, so the two-step "engine emits it, then card starts using it" gap
doesn't need a second wait.

## 2026-09-12: minwu-white-mage trimmed to 1 scenario — found a real dependency in the process

User ask: "1 scenario is enough here. legend rule, lifelink check etc is not
needed. we can just check anthem works." Dropped the 2nd (not-Clerics
negative-case) scenario and the `...keywordScenarios(minwuWhiteMage)` spread
entirely, plus its now-unused imports — matches today's "default 1
scenario, real basic function" trims elsewhere.

Caught before finishing: a bare `trigger:'onLifeGained'`-only scenario
starts `self` already on the Battlefield (harness.ts's `runScenario` —
`selfZone` is forced to `'Battlefield'` whenever `scenario.trigger`/`.ability`
is set), so it emits NO cast/enters/combat-damage trace lines at all. This
card's synergy.json already declares real `cast`, `entersBattlefield`, and
Lifelink `lifegain` (CR 702.15e) SOURCE facts — dropping keywordScenarios()
naively would have orphaned all three, hard-failing verify-synergy (a real
`process.exit(1)` gate, confirmed). No `legendRule` fact is declared here,
so the legend-rule probe really was free to drop outright.

Resolved by keeping the ONE scenario real rather than synthetic: no
top-level `trigger` (so the cast->enters lifecycle actually runs),
`dealsCombatDamage:{amount:3}` (real Lifelink lifegain — no keywordScenarios()
call, just the same synthetic-probe field it uses under the hood), plus
`sequence:['onLifeGained']` to fire the anthem trigger. Still exactly 1
scenario object, no keyword/legend-rule probes. Note: harness.ts always
runs `sequence` BEFORE `dealsCombatDamage` (fixed code order, confirmed via
`runScenario`) — so the trace log shows the anthem trigger firing, THEN the
combat-damage/lifegain lines, not causally "damage causes the trigger."
Read this as "two real things that happen to Minwu this game" (both true,
independently), not a forced cause->effect chain — did NOT reorder
harness.ts to fix this (no card currently combines `dealsCombatDamage` +
`sequence`, confirmed via grep, so reordering would've been safe, but it's
shared infra touching the whole pool — out of scope for a one-card trim;
flagging as a possible future harness.ts polish if a card ever needs the
literal causal order to read right in the replay UI).

Verified: `verify-synergy.mjs minwu-white-mage` — 0 hard failures, only the
same harmless class of informational note the original keywordScenarios
Lifelink probe always produced (`dealDamage` trace line with no matching
declared produce — dealDamage itself was never a declared fact, only its
Lifelink-caused `gainLife` consequence is). Full-pool `verify-synergy.mjs`
— 317 checked, 8 hard failures, none new/related to this change (white-
auracite, zack-fair, etc. — pre-existing, confirmed via `git status` these
are mid-edit from concurrent work already in flight, not touched here).
`npx vitest run functional-model` — 243/243 pass. Regenerated `trace.json`
via `run-scenarios.mjs --slug=minwu-white-mage`. Live-verified via
`curl localhost:3000/api/card/fin/26` (dev server reads scenarios.ts live,
not the committed bundle) — `functionalModel.traces` has exactly 1 entry,
matching the new combined scenario's `result` text.

**Open Forge-verification**: none needed — no oracle-text/vocabulary
change, pure scenario-authoring/coverage fix.

## 2026-09-12 (follow-up): fixed the harness.ts `sequence`-before-`dealsCombatDamage` ordering flagged above

Went back and fixed the fixed-code-order bug this same entry flagged
above as "possible future harness.ts polish" — `runScenario` used to run
`sequence` steps BEFORE `dealsCombatDamage`, unconditionally, so a
`sequence`-fired trigger keyed to a preceding real event (Minwu's own
anthem, `onLifeGained`, reacting to real Lifelink lifegain FROM that same
combat damage) showed backwards in the trace log — the trigger firing,
THEN the damage/lifegain that actually caused it.

Fix: moved the `dealsCombatDamage` block (harness.ts, `runScenario`) up
to run immediately after `lifecycleAfter` (self genuinely on the
battlefield) and BEFORE the `sequence` block, instead of after
`advanceToPhase`/`sacrificeSelfAfter` where it used to sit. Comments on
both blocks updated to state the new ordering contract explicitly.

Pool-wide safety check (grep, before touching code): only
`minwu-white-mage` combines `dealsCombatDamage` + `sequence` anywhere in
the corpus — `cecil-dark-knight-cecil-redeemed-paladin`,
`joshua-phoenix-s-dominant-phoenix-warden-of-fire`, and
`vincent-valentine-galian-beast` also use `dealsCombatDamage` but none use
`sequence`, so none of them could be affected by the reorder. Also
checked `duplicateLegendaryEnters` (same "real event probe" family) and
`advanceToPhase` against `sequence` — no scenario combines either with
`sequence`, so left both in their existing relative positions rather than
moving anything not shown to need it.

Rigorously confirmed the reorder itself (not just my new scenario
authoring) is what's safe pool-wide: `git stash` on just
`harness.ts`+`minwu-white-mage/trace.json`, reran full-pool
`verify-synergy.mjs` against the OLD code — identical 8 FAILs (cargo-ship,
cecil-dark-knight-cecil-redeemed-paladin, dragoon-s-wyvern, il-mheg-pixie,
stiltzkin-moogle-merchant, the-wind-crystal, white-auracite, zack-fair),
all pre-existing per `git status` (their `synergy.json`/`scenarios.ts` are
mid-edit from concurrent work, `trace.json` untouched/stale — nothing to
do with this fix). Restored the stash, diffed against the pre-stash patch
to confirm byte-identical restore. `npx vitest run functional-model` —
243/243 pass, same as before the reorder.

Regenerated `minwu-white-mage/trace.json` via
`run-scenarios.mjs --slug=minwu-white-mage` — log now reads `cast` ->
`enters` -> `dealDamage` -> `gainLife` (cause: Lifelink) -> `trigger`
(onLifeGained) -> reads -> 3x `putCounter`, the correct causal order.
Live-verified via `curl localhost:3000/api/card/fin/26` (dev server
re-runs scenarios.ts live) — same order in the API's `functionalModel`
trace log. Browser-level screenshot (`/app/card/fin/26`) hit the
project's own documented stale-HMR-module-graph gotcha (`does not provide
an export named 'GENERIC_FILLER_ARTIFACT'`, a pre-existing/unrelated
export that long predates this change) both before and after this edit —
not caused by this fix (confirmed the export exists, and the direct API
route resolves fine); didn't restart the shared dev server given other
agents' concurrent work on it, same "confirm via direct API route
instead" fallback the card agent's own notes already establish for this
exact gotcha.

**Open Forge-verification**: none needed — pure trace-log ordering fix,
no oracle-text/vocabulary change. One open item, NOT a Forge question: a
browser-level (not just API-level) screenshot of fin/26 confirming the
new order renders correctly in the replay UI still needs a fresh
dev-server restart to clear the stale-HMR module graph — flag for
whichever agent restarts the dev server next.

## Cost-reduction (CR 601.2f) engine support — new vocabulary, closes ENGINE_GAPS.md gap #7 for the target-conditional spell shape (2026-09-12)

Task: implement fin/19 (Fate of the Sun-Cryst)'s "This spell costs {2}
less to cast if it targets a tapped creature." Confirmed first: NO
cost-reduction vocabulary of any kind existed anywhere before this pass —
`CardDefinition.manaCost` was a fixed printed string, never recomputed per
cast; the only cost-modification hook at all was `AlternateCost` (a full
REPLACEMENT, Flashback-shaped, not a discount on top of the normal cost).
ENGINE_GAPS.md gap #7 already had 3 real-card citations for this exact
missing-machinery class (fate-of-the-sun-cryst target-conditional,
the-wind-crystal color-gated broadcast, qiqirn-merchant activated-ability)
— confirmed by re-reading before building anything, not re-derived from
scratch.

Real Forge citation (WSL Forge install, `res/cardsfolder/cardsfolder.zip`'s
`f/fate_of_the_sun_cryst.txt` — a real shipped card script, no
`../mtg-forge` source checkout available in this environment):
`S:Mode$ ReduceCost | ValidCard$ Card.Self | Type$ Spell | Amount$ 2 |
EffectZone$ All | ValidTarget$ Creature.tapped` — confirms (a) this is
Forge's own general `ReduceCost` static-ability MODE, not a one-off, (b)
the condition requires the target be BOTH a Creature AND tapped (not "any
tapped permanent" — a real, textually-precise distinction from this card's
own separate, broader "Destroy target nonland permanent" effect), (c) it's
keyed on the spell's OWN chosen target, distinct from a broadcast/color-gated
discount (the-wind-crystal) or an activated-ability cost discount
(qiqirn-merchant) — confirmed these really are 3 separate Forge mechanisms
under the same "ReduceCost" umbrella, not 3 views of one, so scoping this
pass to only the target-conditional spell shape is a real, principled cut,
not an arbitrary one.

**Design**: new `card.ts` `CostReduction` interface (`{amount: number,
condition: 'tappedCreatureTarget'}`) on a new optional
`CardDefinition.costReduction` field — deliberately a plain data record
(controlled-vocabulary `condition` string), not an executable predicate,
matching every other declarative field in `card.ts`. `engine.ts`'s
`canCastSpell`/`castSpell` take a new optional trailing
`declaredTarget?: RealCard` param (same "caller supplies the real object,
engine validates" shape `crewedBy` already established for Crew) — real CR
601.2b ("choose targets") genuinely precedes 601.2f ("determine cost"), so
a real caster always knows their target before the discount is computed;
this model's own lazy, resolution-time `chooseTarget` (`card.ts`'s
`applyEffect`) is UNCHANGED — a caller keeps the two in sync by also
setting `EffectContext.preferTarget` to the same `RealCard` (exactly what
`fate-of-the-sun-cryst/scenarios.ts` now does). New exported
`effectiveCastCost(card, alt, declaredTarget)` (engine.ts) computes the
real discounted `ParsedManaCost` + a printed-style string for logging;
`mana.ts` gained `reduceGenericCost` (generic-only, floored at 0, real
118.9 — a discount never touches colored pips) and `formatManaCost`
(inverse of `parseManaCost`, for trace logging the cost ACTUALLY paid, not
the nominal one). A real `AlternateCost` and `costReduction` are
deliberately mutually exclusive (not stacked) — no real card needs both,
same "don't speculatively combine two independent mechanisms" caution
`alt`'s own doc comment already uses elsewhere; `effectiveCastCost` just
skips the reduction check whenever `alt` is given.

`engine-trace.ts`'s `pilotCast` takes the same optional `declaredTarget`
and now logs the REAL cost paid (via `effectiveCastCost`) in its `cast`
log entry's `cost` field, not the nominal printed/alt cost — a real,
intentional behavior change to that field's own semantics (it was always
`alt?.cost ?? card.manaCost` before; a card with no `costReduction` sees
byte-identical output, so this is additive in effect even though the field
itself isn't new — flagged here rather than silently assumed non-breaking,
per `.claude/contracts/state-event-format.md`'s own "changing an existing
entry's shape" caution, though no consumer contract change was needed:
the field's TYPE/presence is unchanged, only its value for a
`costReduction`-bearing card, which no other card has yet).

Implemented fin/19's own `costReduction: { amount: 2, condition:
'tappedCreatureTarget' }` in `definition.ts` (replacing the old
documentary-only `staticAbilities` free-text entry — same "structured
field replaces free text once real" convention `continuousKeywordGrants`'s
own cards, e.g. ardyn-the-usurper, already established: checked that file
first, confirmed it does NOT keep a redundant staticAbilities entry once a
clause has real structured backing). Rewrote `scenarios.ts`'s two existing
engine-piloted scenarios (already real engine-trace-piloted from an
earlier pass, unrelated to this task) to pass the SAME real Coeurl as
`declaredTarget` in both — only its real tapped state differs (one via a
genuine 508.1f combat-attack tap, not a synthetic flag flip) — so the
contrast in what's actually paid is mechanical, not scripted. Regenerated
`trace.json` via `npx vite-node functional-model/scripts/run-scenarios.mjs
fate-of-the-sun-cryst` (flag is a positional arg, NOT `--slug=`, despite
the script's own header comment saying `--slug` — checked the actual
`process.argv.slice(2)` parsing, the header comment is stale/wrong).
Verified in the regenerated trace: tapped-target scenario logs
`cost:'{2}{W}'` and exactly 3 `tapForMana` lines; untapped-target scenario
logs `cost:'{4}{W}'` and 5 — a real, mechanically-enforced discount, not
just a differently-worded log line. `npx vite-node
functional-model/scripts/verify-synergy.mjs fate-of-the-sun-cryst` — 0 hard
failures (same soft-note shape — `tapForMana`/`enters` unrecognized-action
notes — this card's own progress.json already documented pre-existing).

New tests: `mana.test.ts`'s `reduceGenericCost / formatManaCost` describe
block; `engine.test.ts`'s `Cost reduction (CR 601.2f)` describe block —
a synthetic `{3}{G}`-costed card against a 3-mana-source board (genuinely
UNAFFORDABLE without the discount, affordable at the discounted `{1}{G}`)
proving: discount applies + is affordable + taps exactly 2 sources when
`declaredTarget` is a tapped creature; does NOT apply (stays unaffordable)
when the target is an untapped creature, a TAPPED NON-creature (proving
the condition really checks both halves of Forge's own `ValidTarget$
Creature.tapped`, not just "any tapped permanent"), or when no
`declaredTarget` is passed at all (absence is a real "false," never a
silent match); and a real `AlternateCost` correctly does NOT stack with
`costReduction`. Full pool: `npx vitest run functional-model` — 250/250
(was 238 baseline + this task's 7 new + others already added by concurrent
sessions in the shared tree). `npx tsc --noEmit` — no new errors introduced
by any touched file (pre-existing unrelated errors in ~40 other
`cards/*/definition.ts` files, `allowImportingTsExtensions`-related, all
predate this task).

Updated `ENGINE_GAPS.md` gap #7: struck the fate-of-the-sun-cryst
"confirmed still open" paragraph, replaced with a CLOSED writeup (full
design + citation + test list), explicitly scoped to NOT cover the-wind-
crystal's broadcast/color-gated shape or qiqirn-merchant's
activated-ability shape (both still fully open, own paragraphs unchanged)
or a variable/dynamic `amount`. Also trimmed the stale
"alternative-cost-REDUCTION effect" phrase out of gap #7's own intro
paragraph (`alt`'s doc comment) since that's now partially closed rather
than wholly unmodeled.

**Explicitly NOT touched, out of my lane** (flagged for the `card`
agent/review-loop instead): `fate-of-the-sun-cryst/progress.json` was
ALREADY mid-edit in the shared tree before this task started (a concurrent
review-loop pass had set `review: "human"` + added
`oracleTextSnapshot`/`reviewedAt` — confirmed via `git diff`, not
something this task did) — its own `notes`/`knownGaps` text still
describes gap #7 as fully open for this card, now STALE relative to this
closure, and per the standing "review status resets on change" convention
its `review` flag arguably needs resetting back to `"ai"` now that this
task changed the card's own authored `definition.ts`/`scenarios.ts` content
after that human review was recorded. Did not touch `progress.json` or
`synergy.json` myself — both are explicitly the `card` agent's own files
per my domain boundary (`synergy.json`/`trace.json` are "generated output
the card agent also reads" — I regenerated `trace.json` since that's mine
via `run-scenarios.mjs`, but left `synergy.json`'s own fact set, and all of
`progress.json`, untouched). The existing `tapped:true` sink `Fact` in
`synergy.json` (documentary-only, per that file's own note: "not consulted
by satisfiesConstraints") may be worth revisiting now that the condition
it represents has real engine backing — not my call to make.

**Open Forge-verification**: none — the real Forge card script was read
directly (WSL install, `cardsfolder.zip`), matching what got built.

---

## 2026-09-12 (later): ENGINE_GAPS.md gaps #5/#6 closed for real (Hybrid/{X}/dual-color mana sources)

Closed, with real unit tests (`mana.test.ts`/`engine.test.ts`), NOT just
documented:
- **Gap #6**: `parseManaCost` now real-parses Hybrid pips (`{G/U}`-shaped
  → `ParsedManaCost.hybrid: ManaColor[][]`) and `{X}` (→ `xCount: number`,
  CR 107.3c multi-`{X}`-shares-one-value; new `resolveXCost(cost, x)`
  folds a caller-chosen `x` into `generic`, default 0 per 107.3b).
  `engine.ts`'s `effectiveCastCost`/`canCastSpell`/`castSpell` (+
  `engine-trace.ts`'s `pilotCast`) take a new optional `x` param, same
  shape as `declaredTarget`. Grepped the real pool FIRST: exactly 3 cards
  need either shape (Thranduil, Sindarin Liege // Silvan Rally — Hybrid;
  Choco Comet/Doppelgang — `{X}`), zero need Phyrexian or a `{C}`
  cast-cost pip (both still correctly throw, not attempted — no real card
  justifies it).
- **Gap #5's dual/choice-of-color remainder**: `RealCard.manaAbility`
  widened `ManaColor → ManaColor | ManaColor[]`; new `mana.ts`
  `deriveManaAbility` (single-color first, `manaAbilityColorsFromStaticText`
  fallback — that function ALREADY existed for
  `scripts/prefill-mana-facts.mjs`'s synergy-fact generation but was
  explicitly NOT wired to affordability before this pass) is the new real
  call site in `resolveTop`/`playLand`. 12 real Town-cycle lands (Vector,
  Imperial Capital-shaped) now genuinely count toward EITHER of their two
  colors.
- **Shared mechanism, both closures**: `mana.ts`'s new
  `assignManaRequirements` — real exhaustive backtracking (not greedy) over
  `{colors: ManaColor[]}` requirements vs. `sourceColors(card): ManaColor[]`
  sources, since a Hybrid COST pip and a dual-color SOURCE are the exact
  same shape from opposite sides. `canAfford`/`payMana` rewritten around
  this (verified NOT to change behavior for the plain single-color case —
  same source-iteration order). A real backtracking-FORCED test exists
  (`mana.test.ts`) proving this isn't a greedy heuristic that happens to
  work on easy cases: a dual source tried first for one requirement has to
  be un-picked once a later, stricter requirement turns out to have no
  other option.
- **Deliberately NOT attempted this pass** (assessed, stop-and-document
  per the task's own instruction, not half-built): Cargo Ship's restricted
  mana ability ("Spend this mana only to cast an artifact spell...") —
  needs a real spendable-mana-pool tracking mechanism this engine has
  ZERO of (`interfaces.ts`'s `Player.addMana` is a deliberately inert
  observation point), materially bigger/riskier than the assignment
  problem above. Elvish Archdruid's variable amount ("for each Elf you
  control") — needs teaching `payMana` that ONE tap can yield MORE than
  one mana unit, a real extension to the payment model itself, not a
  lookup widening. Both remain real, open, narrower gaps (`ENGINE_GAPS.md`
  gap #5's own remainder paragraph updated to say so precisely).
- **No `cards/*` scenario changes needed** — checked first, not assumed:
  `harness.ts` never calls `parseManaCost` at all (a scenario's board is
  manually specified, not derived from `manaCost`), so this gap only ever
  blocked `engine.ts`'s real-pilot `canCastSpell`/`castSpell` path, which
  none of Thranduil // Silvan Rally / Choco Comet / Doppelgang's own
  `scenarios.ts` use. New engine.test.ts describe blocks
  (`Hybrid mana costs`/`{X} mana costs`) use synthetic `CardDefinition`s
  with the SAME real cost strings instead, proving `canCastSpell`/
  `castSpell` can now actually cast them (previously `parseManaCost` threw
  unconditionally on either symbol).
- Cargo Ship's own restricted `{T}: Add {C}. Spend this mana only to...`
  ability (declared 2026-09-12, earlier same day by a concurrent pass) is
  UNCHANGED by this — still correctly not auto-detected as a payable
  source (it's on `abilities`, not `staticAbilities`, and even if it were,
  the restriction text fails both `manaAbilityColorFromStaticText`/
  `manaAbilityColorsFromStaticText`'s own regexes).

**Verification**: `vitest run functional-model` → 279/279 (all suites, up
from 238 baseline noted elsewhere in this file — most of the delta is
concurrent sessions' own work, not this task's; this task added ~30 new
mana/engine tests). `tsc --noEmit` → same pre-existing baseline errors
only (none in `mana.ts`/`engine.ts`/`engine-trace.ts`/`state.ts`, checked
by grepping the error list for those 4 files specifically). `verify-
synergy.mjs` full pool → 317 checked, 8 hard failures — confirmed via a
real `git stash` of ONLY my own touched files (`mana.ts`/`mana.test.ts`/
`engine.ts`/`engine.test.ts`/`engine-trace.ts`/`state.ts`) and a
before/after re-run that ALL 8 are pre-existing/concurrent-session noise
(cargo-ship, cecil-dark-knight, dragoon-s-wyvern, il-mheg-pixie,
stiltzkin-moogle-merchant, the-wind-crystal, white-auracite, zack-fair —
identical failure set with or without my changes; the repo has ~239
`cards/*` files modified by other concurrent sessions right now, per
`git status`, none of which I touched).

**Open Forge-verification still needed**: none for this pass —
`ManaCostShard.java`/`ManaCostParser.java` (forge-core/src/main/java/
forge/card/mana/) were read directly from the real `tmp/mtg-forge`
checkout for both the Hybrid pip shard names (lines ~36-45) and the `X`
shard (line 84), matching what got built. XMage not consulted (not needed
— Forge alone resolved both symbol shapes unambiguously).

## ENGINE_GAPS.md gap #16 closed for real (2026-09-12) — "play the top card of your library" + "attacked this turn"

Two independent primitives, both real, both used together on The Lunar
Whale (fin/60):

- **`card.ts`'s new `kind:'playFromLibraryTop'` Effect** (no fields — CR
  601/305's own "play" dispatch is total, never scoped to a subset) reads
  `ctx.you.getCardsIn('Library')[0]` and calls a new `Actions.play(player,
  target, card?)` — extended `interfaces.ts`'s own pre-existing but
  never-actually-used ambient `play(player, target)` stub with an optional
  3rd `card?: CardDefinition` param, since `RealCard` carries no live
  `CardDefinition` reference (a new `EffectContext.topLibraryCard`, caller-
  supplied, same convention `castFrom`/`declaredTarget` already establish,
  threads it through).
- **`engine.ts`'s new `canPlayFromLibraryTop`/`playFromLibraryTop`** — the
  REAL dispatch, reusing `canPlayLand`/`playLand` (land) or
  `canCastSpell`/`castSpell` (anything else) VERBATIM, plus a genuine check
  that the given `RealCard` really is `caster.library[0]` right now. Real
  Forge citation: `PlayEffect.java` (forge-game/.../ability/effects/
  PlayEffect.java) ~line 330-351 (land branch, `tgtSA.isLandAbility()`,
  resolved directly, no stack) / ~line 307-473 (spell branch,
  `playSaFromPlayEffect`, the real cast path) — same land-vs-spell dispatch
  shape, independently confirmed against a real checkout, not assumed from
  CR text alone.
- **Where the real dispatch actually LIVES**: `engine-trace.ts`'s
  `pilotActions` override of JUST the `play` method (every other `Actions`
  method stays `loggingActions`'s shared implementation, unchanged) — the
  ONLY place with a real `GameEngine` reference `canPlayLand`/`castSpell`
  need. `harness.ts`'s own `loggingActions.play` is a real but plain (no
  legality/mana) fallback for a card NOT on the engine-piloted pilot path —
  same accepted scope every other `loggingActions` method already has.
- **`RealCard.attackedThisTurn`** (state.ts) — a real, persistent
  per-permanent boolean (NOT a turn-number comparison like
  `GameEngine.enteredThisTurn` — this one's simply reset false every
  Cleanup), set unconditionally by `engine.ts`'s `declareAttackers` for
  every real declared attacker, cleared by a new
  `state.clearAttackedThisTurn()` called from `turn.ts`'s Cleanup branch
  alongside `clearAllDamage`/`clearUntilEndOfTurnKeywordGrants` (and,
  concurrently added same day by another session, `resetFlippedCoinThisTurn`
  — no conflict, just ordered alongside it). Real Forge citation:
  `CardDamageHistory.attackedThisTurn`/`hasAttackedThisTurn(GameEntity)`
  (forge-game/.../card/CardDamageHistory.java lines 26-27/88-90), set via
  `setCreatureAttackedThisCombat` (~54-59, called from `CombatUtil.java`
  ~386 at attacker declaration), cleared each turn by `newTurn()` (~282-283)
  — functionally identical to "cleared at this engine's own Cleanup," since
  Cleanup is always the last phase before the next Untap in this engine's
  fixed 12-phase list.

**Wired together for real on The Lunar Whale itself**
(`cards/the-lunar-whale/definition.ts`): `triggers:
[{name:'playFromLibraryTop', effects:[{kind:'playFromLibraryTop'}]}]` — NOT
a real CR 603 trigger (a continuous granted PERMISSION, not something that
triggers), reusing the "named effect bundle, manually invoked via
`pilotFireTrigger`" shape already established for a real triggered ability
this engine can't auto-fire (Ultima Weapon's `onEquippedAttacks`). A pilot
script is responsible for only invoking it once `attackedThisTurn` is
genuinely set — the engine primitive itself doesn't know about a specific
card's own gating condition (same split `crewedBy`/`declaredTarget`
establish elsewhere) — deliberate, not an oversight.

`cards/the-lunar-whale/scenarios.ts` (`runEngineScenarios`) — the FIRST
real engine-piloted Crew scenario in the pool (extended `pilotActivate` to
take an optional `crewedBy: RealCard[]`, mirroring `canActivateAbility`/
`activateAbility`'s pre-existing param; every other `crewCost` card stays
on the flat `harness.ts` style specifically to sidestep the latent
crew/second-ability collision bug noted elsewhere in ENGINE_GAPS.md, which
doesn't apply to The Lunar Whale since it has only one ability): crew
(real Item Shopkeep tap) → real attacker declaration (genuinely sets
`attackedThisTurn`) → **a real rules wrinkle caught live, not assumed**:
playing a land/casting a spell off this permission is STILL only legal in
a main phase with an empty stack (305.3/307.1a) even though the "you may"
grant itself says nothing about timing — my first draft tried to invoke
the ability immediately after declaring attackers (still in
CombatDeclareAttackers) and `canPlayLand`'s own existing sorcery-speed gate
correctly rejected it; fixed by advancing to Main2 first, a real,
demonstrable confirmation the engine enforces this correctly, not a
scenario bug to route around → the real top card played twice: a real
Forest (dispatches to `playLand` — direct Battlefield move, no Stack) then,
once it's gone, a real Barret Wallace underneath it (dispatches to
`castSpell` — real `{3}{R}` paid, pushed onto and resolved off the real
Stack via `pilotResolveTop`, called unconditionally after each `play`
invocation — a safe no-op for the land branch, which never touches the
Stack).

**verify-synergy.mjs**: the former `isLunarWhalePlayFromLibraryFact`
exemption is REMOVED (real trace evidence now exists) — new `case 'play'`
in `producedEvents` (`return [{event:'play', side:'you'}]`, same
unconditional shape `case 'cast'`/`case 'playLand'` already have), `'play'`
added to `explainableFns`. One real new wrinkle needed its own exemption:
the effect's own `ctx.you.getCardsIn('Library')` peek logs as a
`read:getCardsIn`, which the reverse "every aggregate read needs a matching
declared want" check misread as "this card wants Library-zone presence" (it
doesn't — it's just how the effect finds what to play) — fixed with a new
SHAPE-scoped (not name-scoped, unlike `isCloudUltimaWeaponComboRead`)
`isPlayFromLibraryTopPeekRead(e, allEntries)` — deliberately general so
Traveling Chocobo's own identical clause (fin/158, unmigrated — confirmed
it now exists in the pool, still unmigrated, its `staticAbilities` text
already documents this exact clause and cross-references The Lunar Whale)
can reuse this same vocabulary/primitive/exemption once migrated, without
re-deriving any of it — its own narrower "lands and Bird spells only"
scope is a gate on WHETHER to invoke the effect, not a different effect
shape, so genuinely zero further engine work is needed for it.

**Real, still-open, adjacent gap, deliberately NOT force-closed**: The
Regalia (fin/58)'s own attack-triggered "reveal cards from the top of your
library UNTIL you reveal a land" is an UNBOUNDED dig-until-a-match effect —
genuinely different machinery from "look at exactly the top card, dispatch
on its type." Checked before deciding: `card.ts`'s `dig` Effect only covers
a FIXED `qty`, and `kind:'playFromLibraryTop'` only ever looks at ONE card
— reusing either for Regalia would misrepresent an unbounded search as a
bounded peek. Left as the pre-existing honest no-op `custom` Effect,
unchanged.

**Tests**: `engine.test.ts`'s new `canPlayFromLibraryTop /
playFromLibraryTop` describe block (5 cases: rejects a non-top card
mutating nothing; land dispatches to real `playLand`, Battlefield move, no
Stack, real ETB fires, per-turn counter increments; spell dispatches to
real `castSpell`, real mana paid, pushed onto the Stack; unaffordable spell
rejected; rejected outside sorcery-speed timing) plus 2 new cases in its
existing `declareAttackers` describe block (legal declaration sets
`attackedThisTurn`; a rejected attempt does NOT set it). `turn.test.ts`'s 2
new cases (the flag persists through every remaining phase of the turn
once set, clears at real Cleanup; does NOT persist into a later turn — a
real per-turn reset, not a one-time clear).

**Verification**: `vitest run functional-model` → 299/299 (up from 282
baseline at task start; +17, of which ~9 are this task's own new tests, the
rest concurrent sessions'). `tsc --noEmit` → 48 pre-existing errors, none
in any file this task touched (grepped the error list for
engine.ts/state.ts/card.ts/turn.ts/harness.ts/engine-trace.ts/
interfaces.ts/the-lunar-whale/verify-synergy specifically — zero hits).
`verify-synergy.mjs` full pool → 317 checked, 4 skipped, 8 hard failures —
same 8 (cargo-ship, cecil-dark-knight, dragoon-s-wyvern, il-mheg-pixie,
stiltzkin-moogle-merchant, the-wind-crystal, white-auracite, zack-fair) as
another concurrent session's own independent before/after check the same
day, confirming these are pre-existing/concurrent-session noise, not
anything this task touched. The-lunar-whale itself: 0 hard failures, only
accepted soft notes (tap/attack/playLand/tapForMana — same "note, not fail"
class every other card's own tap/attack/mana-tap soft notes already have
pool-wide).

**Open Forge-verification still needed**: none for this pass —
`PlayEffect.java` and `CardDamageHistory.java` were both read directly from
the real `tmp/mtg-forge` checkout (not reasoned from CR text alone), and
both citations were independently confirmed against the actual dispatch
logic built (land-vs-spell branch; attackedThisTurn set/clear call sites).
XMage not consulted — Forge alone resolved both shapes unambiguously.

**Note for the `card` agent**: Traveling Chocobo (fin/158) exists in the
pool today as `staticAbilities` free text only (unmigrated) — its own
comment already cross-references The Lunar Whale's real
`kind:'playFromLibraryTop'` vocabulary as directly reusable once migrated.

---

## 2026-09-12 (later same day): ENGINE_GAPS.md gap #7 remainder + gap #11 remainder closed

Task: close gap #7's flat/broadcast + board-counted cost-reduction
examples (The Wind Crystal, Qiqirn Merchant — fate-of-the-sun-cryst's
target-conditional case was already closed earlier this same day) and gap
#11's remainder ({X}/Pay-N-life on activated abilities, the crewCost/
abilityName routing bug), with real unit tests + real scenario evidence.
Ran concurrently with at least 2 other agents in the same working tree
(one closing gap #6 Hybrid/{X} mana on the CAST side — reused rather than
duplicated; one closing gap #8b lifegain-doubling on `the-wind-crystal`
itself — coordinated via git-status polling + narrow, surgical edits,
confirmed compatible, no collision).

**Generalized cost-discount design** (one hook, not three one-offs):
- `card.ts`: kept pre-existing `CostReduction` (cast-side, target-
  conditional, fate-of-the-sun-cryst) as-is. Added `ActivationCostReduction
  {amountPerMatch, subtype}` on `CardDefinition.abilities[].costReduction`
  (activation-side, board-counted — Qiqirn Merchant's `bigDraw`, real Forge
  `SVar:X:Count$Valid Town.YouCtrl`, `res/cardsfolder/q/
  qiqirn_merchant.txt`). Added `SpellCostReductionGrant {amount, colors}`
  on `CardDefinition.spellCostReductionGrants` (broadcast onto OTHER
  spells, lives on the GRANTING permanent — The Wind Crystal, real Forge
  `Mode$ ReduceCost | ValidCard$ Card.White | Activator$ You | Amount$ 1`,
  `res/cardsfolder/t/the_wind_crystal.txt`).
- `state.ts`: `RealCard.spellCostReductionGrants` (copied at `resolveTop`,
  same pattern `continuousKeywordGrants` established) + new
  `activeSpellCostDiscount(caster, cardColors)` summing matching grants
  across the caster's OWN battlefield only (Forge's `Activator$ You`).
- `engine.ts`: `effectiveCastCost` gained a 5th param `caster?: RealPlayer`
  — sums target-conditional + broadcast discount (both skipped when `alt`
  is set), applies via the existing `reduceGenericCost`. New exported
  `effectiveActivationCost(engine, controller, card, abilityName?, x?)`
  generalizes the SAME machinery to activated abilities: resolves `{X}`
  via the (concurrently-built) `resolveXCost` first, then applies board-
  counted discount, patching the cost string via a targeted
  `cost.replace(/\{\d+\}/, ...)` (tolerates free text like `{T}`/
  `Sacrifice this creature` around the bracket token).
  `canActivateAbility`/`activateAbility` both now call this helper instead
  of parsing the mana portion inline.

**Gap #11 remainder, closed**:
- `{X}` on activated abilities: threaded through
  `effectiveActivationCost`/`canActivateAbility`/`activateAbility` as an
  optional `x?` param, same shape `declaredTarget`/`crewedBy` already
  establish. Real pool motivation: Rydia, Summoner of Mist's own `{X}`-
  costed ability.
- "Pay N life" as an activation cost: new `costRequiresLifePayment(cost)`
  (`/\bPay (\d+) life\b/i`); `unsupportedCostComponent` now accepts it;
  `canActivateAbility` rejects on insufficient life,
  `activateAbility` genuinely deducts it. This FLIPS previously-documented
  behavior for Dark Knight's Greatsword's real `Equip—Pay 3 life` (used to
  correctly reject as unsupported; now correctly payable) — rewrote that
  test into two real cases (paid successfully, life 20→17; still rejected
  when life is insufficient).
- crewCost/abilityName routing bug (flagged in an earlier pass, not fixed
  then): `canActivateAbility`/`activateAbility` used to branch on
  `card.crewCost !== undefined` UNCONDITIONALLY before checking
  `abilityName`. Fixed: gate is now `card.crewCost !== undefined &&
  abilityName === undefined`. The "or the named ability doesn't exist"
  half of the original instruction was ALREADY correctly handled by the
  pre-existing `if (!cost) return {ok:false, reason:'has no such
  activated ability'}` early return — confirmed via a new synthetic
  Cargo-Ship-shaped fixture (crewCost + a separate named ability) rather
  than assumed.

**Card-level authoring**: `the-wind-crystal/definition.ts` —
`staticAbilities` cost-reduction line replaced with
`spellCostReductionGrants: [{amount: 1, colors: ['W']}]`; real
`event:'costReduction'` `Fact` authored in `synergy.json`, exempted from
trace-evidence checking (`verify-synergy.mjs`'s new
`card.name === 'The Wind Crystal' && p.event === 'costReduction'` line —
zero possible evidence given this card's own scenario doesn't cast a
second spell, same class as `isAuronsInspirationBroadcastPumpFact`).
Deliberately did NOT touch `the-wind-crystal/scenarios.ts` this pass (the
concurrent gap-8b agent was actively editing that same file for an
unrelated clause) — known, flagged limitation: the discount is real +
independently unit-tested, but not demonstrated end-to-end in this card's
own trace. `qiqirn-merchant/definition.ts`'s `bigDraw` ability gained
`costReduction: {amountPerMatch: 1, subtype: 'Town'}`; its pre-existing
self-sacrifice-cost `Fact` gained a purely-descriptive
`costReductionPerControlled` field (`synergy.ts`, NOT consulted by
`factsInteract`, same convention as `tapped`/`untilEndOfTurn`) — no new
`verify-synergy.mjs` exemption needed (already covered by the pre-existing
`isSelfSacrificeActivationCostFact` shape check).
`qiqirn-merchant/scenarios.ts` WAS updated (no collision risk — untouched
by any concurrent agent): added 2 real Town lands to the battlefield
(Capital City, Gongaga, Reactor Town — real FIN `Land — Town` cards, both
enter untapped with no ETB trigger), replaced the hardcoded `bigDraw` cost
log string with a real call to `effectiveActivationCost(pilot.engine,
pilot.you, qiqirnMerchant, 'bigDraw')` — the regenerated `trace.json` now
genuinely shows `"cost": "{5}, {T}, Sacrifice Qiqirn Merchant (costs {1}
less for each Town you control)"` (7 minus 2, board-state-computed, not
scripted).

**New tests** (`engine.test.ts`): "Cost reduction — flat, unconditional,
BROADCAST from a DIFFERENT permanent" (3 cases: matching color discounts,
non-matching color doesn't, opponent's permanent doesn't); "Cost reduction
— board-state-COUNTED, on an ACTIVATED ABILITY's own cost" (2 cases: 5
matching permanents discount, 0 leaves it unaffordable); "{X} cost on an
ACTIVATED ABILITY" (3 cases: real X resolved+paid, unaffordable X
rejected, omitted X defaults to 0); crewCost+named-ability routing (2
cases, synthetic Cargo-Ship-shaped fixture); rewritten Equip—Pay-3-life
pair (paid for real + correctly-rejected-when-insufficient).

**Verification**: `vitest run functional-model` → 317/317 passed (13
files), zero new failures. `verify-synergy.mjs` full pool → 317 checked, 4
skipped, 7 hard failures — `qiqirn-merchant` and `the-wind-crystal` both
`note` only (soft, non-fail; the-wind-crystal's one note is an unrelated
legendRule non-match, nothing to do with the cost-reduction fact). The 7
FAILs (cargo-ship, cecil-dark-knight, dragoon-s-wyvern, il-mheg-pixie,
stiltzkin-moogle-merchant, white-auracite, zack-fair) are pre-existing/
concurrent-session noise — none are files this task touched, confirmed
against another concurrent session's own same-day before/after baseline
(see the entry immediately above this one: same 8-then-7 failure set,
modulo the-wind-crystal moving from FAIL to note as gap #8b closed
elsewhere).

**Open Forge-verification still needed**: none for the mechanisms
themselves — `the_wind_crystal.txt` and `qiqirn_merchant.txt` were both
read directly from the real `tmp/mtg-forge` checkout, and the
`ReduceCost`/`Count$Valid ... .YouCtrl` shapes cited above were confirmed
against the actual script text, not reasoned from Scryfall oracle text
alone. XMage not consulted — Forge alone resolved both shapes
unambiguously. Two real, deliberately-flagged remainders for a future
pass: (1) The Wind Crystal's own scenario doesn't demonstrate the
broadcast discount end-to-end (see above — needs a second real white
spell cast from the same controller's hand); (2) a variable/dynamic
`amount` on the CAST-side `CostReduction` shape (as opposed to the
ACTIVATION-side shape, which already supports board-counted `amount`) is
still not modeled — no real FIN card needs it today, checked, so left
open rather than spec'd speculatively.

---

## Gaps #8/#8b/#15 closed (2026-09-12): damage-prevention shields,
## lifegain-doubling replacement, coin-flip primitive + Edgar's replacement

Same design shape as the already-closed STUN/FINALITY counter
replacements (see much earlier entries in this file): a narrow,
always-on/short-lived check at the ONE real mutation chokepoint, NOT
general 614/616 replacement-effect machinery. All three reuse the SAME
existing `Keyword`/`effectiveKeywords`/`grantKeyword` machinery a real
keyword grant already uses (the `'Unblockable'` precedent) — no new
`CardDefinition`/`RealCard` field invented for any of them.

**Gap #8 — damage-prevention shields.** Two new `Keyword`s:
`'DamagePrevention'` (ALL damage — Crystal Fragments/Summon: Alexander,
`R:Event$ DamageDone | Prevent$ True | ActiveZones$ Command | ValidTarget$
Creature.YouCtrl`, `res/cardsfolder/c/
crystal_fragments_summon_alexander.txt`) and `'CombatDamagePrevention'`
(combat only — Diamond Weapon, `R:Event$ DamageDone | Prevent$ True |
IsCombat$ True | ValidTarget$ Card.Self`, `res/cardsfolder/d/
diamond_weapon.txt`). `state.dealDamage` gained an `opts?: {combat?:
boolean}` param (threaded from `engine.ts`'s `resolveCombatDamage`'s 5
call sites — the only place combat vs. non-combat damage needs
distinguishing) and now checks both keywords before marking damage;
returns `{lifeGained, prevented}` instead of `void`. A prevented hit
skips Lifelink too (correctly — Lifelink triggers off damage actually
being dealt, 702.15e). `cards/crystal-fragments-summon-alexander/
definition.ts`'s Chapters I/II no longer no-op (`run: () => {}`) — both
now run `{kind:'grantKeywordAll', predicate:'creatures-you-control',
keyword:'DamagePrevention', untilEndOfTurn:true}`, reusing the existing
514.2-Cleanup-based `untilEndOfTurnKeywordGrants` expiry (no new duration
mechanism). `cards/diamond-weapon/definition.ts`'s old freeform "Immune"
`staticAbilities` text replaced with `keywords: ['Reach',
'CombatDamagePrevention']`. **Scope, precisely, mechanically enforced not
just documented**: Crystal Fragments' shield is ALL damage to its own
creatures; Diamond Weapon's is COMBAT-ONLY to itself — deliberately
asymmetric.

`engine.ts`'s `CombatDamageResult` gained `prevented: RealCard[]`.
`harness.ts`'s `loggingActions.dealDamage` now logs `fn:'damagePrevented'`
IN PLACE OF `fn:'dealDamage'` when a shield fires (same "replace, don't
append" precedent `destroy`/`destroyPrevented` already set). New
`engine-trace.ts` `pilotResolveCombatDamage` — the FIRST real-combat pilot
helper in the pool (grepped: no card had ever piloted real combat damage
through `engine-trace.ts` before) — needed to migrate Diamond Weapon's
own `scenarios.ts` off the flat `harness.ts` style (which has zero combat
modeling) onto a real `engine-trace.ts` pilot: cast → real opponent
attacker (Hill Gigas, 5/4 Trample/Haste, real FIN card) attacks → Diamond
Weapon blocks → real combat damage resolves, its own 5 damage genuinely
prevented while its own 8 power still hits Hill Gigas unshielded.

**Gap #8b — lifegain-doubling.** `state.ts`'s `gainLife` (previously a
bare `real.life += amount; return true;`, no interception point) now
checks a new `'LifegainDouble'` `Keyword` (The Wind Crystal, `R:Event$
GainLife | ReplaceWith$ GainDouble ...
SVar:X:ReplaceCount$LifeGained/Twice`, `res/cardsfolder/t/
the_wind_crystal.txt`) across the gaining player's own battlefield,
doubling the amount actually applied. `dealDamage`'s own Lifelink payout
now routes through this SAME `gainLife` chokepoint, so Lifelink under a
doubler is doubled too, free. `cards/the-wind-crystal/definition.ts` now
declares `keywords: ['LifegainDouble']` (replacing the old documentary
`staticAbilities` text) — this landed in the SAME file a concurrent
session was independently closing gap #7 in (`spellCostReductionGrants`)
at the same time; both fields coexist cleanly in the final merged file,
confirmed no data loss either direction. New synthetic-probe
`Scenario.playerGainsLife?: {amount: number}` (`harness.ts`, mirroring the
existing `dealsCombatDamage` synthetic-probe precedent — a real MTG event
independent of any card's own effect) lets this card's own scenario
demonstrate the doubling with genuine trace evidence even though the card
itself never itself causes a lifegain event. `loggingPlayer.gainLife` now
diffs real player life before/after the call (not trusting the input
`amount`) and additively logs `requestedAmount` only when it differs.

**Gap #15 — coin-flip primitive + Edgar's Two-Headed Coin.** New
`state.ts` `flipCoin(player, won): boolean` — mirrors `priority.ts`'s own
"no AI, caller supplies the decision" convention exactly (no dice-rolling/
RNG infrastructure invented; an ordinary flip's outcome is still 100%
caller-supplied, same as every other decision point in this engine). New
`GameState.flippedCoinThisTurn: Set<playerId>` tracks whether a player's
FIRST flip of the turn already happened (cleared at Cleanup by new
`resetFlippedCoinThisTurn()`, wired into `turn.ts` alongside the other
existing Cleanup resets). New `'TwoHeadedCoin'` `Keyword` (Edgar, King of
Figaro, `S:Mode$ FlipCoinMod | ValidPlayer$ You | CheckSVar$
Count$YouFlipThisTurn | SVarCompare$ EQ0 | Result$ True`,
`StaticAbilityFlipCoinMod.java`, `res/cardsfolder/e/
edgar_king_of_figaro.txt`) forces a win on a player's first flip of the
turn, overriding the caller's own requested outcome — the narrow
replacement hook, not general 614/616 machinery. `cards/
edgar-king-of-figaro/definition.ts` now declares `keywords:
['TwoHeadedCoin']` (old `staticAbilities` text removed). Its
`scenarios.ts` had a real correctness bug fixed mid-migration: the manual
`pilot.state.addCard(...)` construction for Edgar's own `RealCard` was
missing `keywords: edgarKingOfFigaro.keywords` entirely — without it,
Edgar's own printed keyword would never land on the actual battlefield
object, and `state.flipCoin`'s check would silently find nothing. The
scenario now invokes `state.flipCoin` directly as a synthetic probe
(same class as the `playerGainsLife` probe above), deliberately
REQUESTING A LOSS to prove the replacement genuinely overrides the
caller's own input rather than coincidentally agreeing with it — logs
`{fn:'coinFlip', player, won, requestedWin, forced}`.

**Facts / verify-synergy.mjs**: `producedEvents` gained 3 new cases —
`damagePrevented` → `preventDamage`; `coinFlip` → `winCoinFlip` when
`entry.forced`, else plain `coinFlip`; `gainLife` also emits
`lifegainDouble` when `entry.amount > entry.requestedAmount`. All 3 added
to `explainableFns`. **Removed a now-stale exemption**: the old
`isSummonAlexanderDamagePreventionFact` function (`verify-synergy.mjs`)
assumed "genuinely blocked, zero possible trace evidence" for Crystal
Fragments' own `preventDamage` fact — false now that the mechanism and
its trace evidence both exist; removed per the original task instruction
not to leave stale exemptions in place once real evidence is achievable.
Also dropped an ungrounded, unrelated stale fact on Diamond Weapon's own
`synergy.json` (a Graveyard-zone fact whose only "evidence" came from a
`keywordScenarios`-injected legend-rule duplicate-enters scenario dropped
during the `engine-trace.ts` migration — no real textual basis on this
card, same precedent as an earlier Edgar migration's own boilerplate
removal). New `synergy.ts` `describeFact` branches: `winCoinFlip` → "win
coin flips", `lifegainDouble` → "double lifegain". Ran
`compute-weights.mjs` for all 4 cards (MUST run from repo root, not
`functional-model/` — its `cardsDirPath` is `join(process.cwd(),
'functional-model/cards')` — running from inside `functional-model/`
silently reports "pool: 0 cards") — all `-1` placeholder weights
resolved to real values (confirmed via grep, no `-1` remains in any of
the 3 non-Diamond-Weapon synergy.json files; Diamond Weapon's own
`preventDamage` fact resolved to `value: 1`).

**New tests** (`state.test.ts`, ~17 new across 3 describe blocks): `dealDamage
— damage-prevention shields` (6: all-damage shield blocks combat +
non-combat, combat-only shield blocks combat but not non-combat, a
GRANTED — not printed — shield works via `state.grantKeyword` same as a
printed one, no-shield negative path, fully-prevented hit grants no
Lifelink, Lifelink works when not prevented); `gainLife —
lifegain-doubling replacement` (6: doubles the amount, no doubler = normal,
an opponent's doubler doesn't cross-affect, two doublers still only
double once — documented non-stacking simplification, Lifelink through
the same chokepoint gets doubled too, amount 0 stays 0); `flipCoin —
coin-flip resolution + Two-Headed Coin replacement` (5: forces a win
overriding the caller's request, no Two-Headed Coin = passthrough both
ways, a second flip the same turn is unaffected — CR's own "the FIRST
time" wording mechanically enforced, `resetFlippedCoinThisTurn` resets
first-flip status, an opponent's Two-Headed Coin doesn't cross-affect).

**Scenarios** (1 each, default rule, no real branching needed): Crystal
Fragments/Summon: Alexander — added a real 3-damage hit against the
player's own creature per chapter, shown genuinely prevented. Diamond
Weapon — fully migrated to `runEngineScenarios()` (real cast → real
opponent attack via Hill Gigas → block → real combat damage, with the
5-damage combat-only shield firing and Diamond Weapon's own 8 power still
connecting unshielded). The Wind Crystal — added a second scenario using
the new `playerGainsLife` synthetic probe (3 life requested, 6 applied).
Edgar, King of Figaro — added the `state.flipCoin` synthetic-probe step
(loss requested, win forced) plus the `keywords` construction bugfix
above.

**Verification**: `vitest run functional-model` → 317/317 passed (13
files) — same count as before this pass (script-only changes don't add
test count beyond the 17 new `state.test.ts` cases already reflected in
that total). `verify-synergy.mjs` scoped to the 4 cards → 0 hard failures
(only pre-existing/expected soft notes: tapForMana, drawCard-from-lands,
untap, transform, putCounter/LORE, block/tap/attack from combat pilot
helpers, legendRule from `keywordScenarios`) both BEFORE and AFTER
removing the stale exemption (confirmed the removal didn't regress
anything). `verify-synergy.mjs` full pool → 317 checked, 4 skipped, 7
hard failures, ALL in cards this task never touched (cargo-ship,
cecil-dark-knight, dragoon-s-wyvern, il-mheg-pixie,
stiltzkin-moogle-merchant, white-auracite, zack-fair) — confirmed via
`git status` showing heavy, genuinely concurrent activity across the pool
from other sessions at the time of this check (see below).

**Open Forge-verification still needed**: none — all 4 real Forge card
scripts (`crystal_fragments_summon_alexander.txt`, `diamond_weapon.txt`,
`the_wind_crystal.txt`, `edgar_king_of_figaro.txt`) plus the 2 relevant
Java sources (`StaticAbilityFlipCoinMod.java`, `FlipCoinEffect.java`) were
read directly from the real `tmp/mtg-forge` checkout, not reasoned from
Scryfall oracle text alone. XMage not consulted — Forge alone resolved
all 4 shapes unambiguously.

**Cross-session note, flagged for the orchestrator**: mid-task,
confirmed a SECOND, genuinely concurrent engine-agent session was
actively working the same shared files at the same time — `state.ts`,
`card.ts`, `engine.ts`, `engine-trace.ts`, and (most notably)
`cards/the-wind-crystal/definition.ts`/`scenarios.ts`/`progress.json`
itself, closing ENGINE_GAPS #7 (cost-reduction) and #16
(play-from-library-top) in parallel with this pass's own #8b work on the
exact same card. No data loss on either side (verified the final merged
state of every shared file), but this is exactly the "two orchestrators
dispatching specialist work that edits the same files at the same time"
risk CLAUDE.md's own "Multiple orchestrators" section calls out —
surfaced here rather than silently absorbed.

**Housekeeping note, not acted on**: this notes.md file is ~13.2k lines /
864KB — large enough that a full `Read` now fails (256KB cap) and only
offset/limit reads work. Not this pass's call to prune/rotate it, but
worth flagging for whoever owns memory-file hygiene.

---

## 2026-09-12 (later same day): the 7 "concurrent-session noise" verify-synergy failures were a real standing regression — stale trace.json, not noise

Every same-day agent report that touched cargo-ship, cecil-dark-knight-
cecil-redeemed-paladin, dragoon-s-wyvern, il-mheg-pixie,
stiltzkin-moogle-merchant, white-auracite, zack-fair attributed their own
`verify-synergy.mjs` hard failures to "concurrent-session noise, not
mine" and moved on. That attribution was wrong for all 7, confirmed by
re-running with the agent pool actually quiet (`ListAgents` showed none
active). Root cause, confirmed via file mtimes: every one of the 7 had a
`scenarios.ts` edited AFTER its own `trace.json` (all 7 trace.json files
shared the exact same 04:26 timestamp — clearly a single earlier batch
regeneration — while each card's own scenarios.ts was independently
touched later, 09:30–10:00, by a later same-day agent that never re-ran
`run-scenarios.mjs` afterward). The failures were 100% real and
reproducible — not flaky, not another session's in-flight edit.

**Fix, all 7, same shape**: `npx vite-node functional-model/scripts/
run-scenarios.mjs --slug=<slug>` (scoped — never the unscoped/no-slug
form, which clobbers every card's trace.json pool-wide, a known footgun).
Zero logic bugs found on any of the 7 — every single failure resolved to
"note-only" or "OK" from a pure trace regeneration, no scenarios.ts/
definition.ts/verify-synergy.mjs edits needed. Re-verified one at a time
after each regeneration to confirm real resolution, not re-attribution.

**Final state**: `verify-synergy.mjs` full pool → 317 checked, 4 skipped,
**0 hard failures** (down from the standing 7). `npx vitest run
functional-model` → 317/317 passed, 13 files.

**Lesson for future passes**: a card's own `scenarios.ts`/`definition.ts`
edit is not "done" until `run-scenarios.mjs --slug=<slug>` has actually
been re-run afterward and `verify-synergy.mjs` re-checked against the
FRESH trace — an agent that edits scenarios.ts and reports "verify-synergy
clean" from a PRE-edit trace check (or defers regeneration to "someone
else, later") will silently leave exactly this kind of stale-trace
regression behind. If several cards in the pool fail `verify-synergy.mjs`
with the SAME failure set across several consecutive agent reports in one
day, check trace.json mtimes against scenarios.ts mtimes before assuming
"noise" — a genuinely quiet pool (confirmed via `ListAgents`) with a
persistent, identical failure list is a real regression, not transient
concurrent-session interference.

Each of the 7 cards' own `progress.json` `notes` field now documents this
fix inline (prepended, dated, the earlier authoring note kept below it
for history) — `verifySynergy`/`lastVerified` fields were already correct
(the failure was purely a trace-staleness artifact, not a fact-authoring
regression), so those fields were left as-is.

**Open Forge-verification still needed**: none — this was a pure
tooling-discipline fix (regenerate-trace-after-scenario-edit), no engine
behavior or card definition changed on any of the 7 cards.

---

## 2026-09-12 (later still): ENGINE_GAPS.md gap #14's remaining sub-gap CLOSED for real — static P/T bonus + dynamic type grant, Equipment-broadcast, 7 real cards

Task: close the one sub-piece of gap #14 that was still marked open —
Dragoon's Lance's own "+1/+0 and is a Knight in addition to its other
types" (and its siblings across 6 other Equipment cards) had real `Fact`s
(`event:'pump'`, `event:'grantType'`) but no execution: `card.ts`'s
`animate` dispatch is self-only, so nothing ever applied a static P/T
bonus or a dynamic type grant to whatever creature an Equipment is
attached to.

**Real cards, grepped fresh (not trusted from the task prompt alone)**:
Dragoon's Lance, Machinist's Arsenal, Paladin's Arms, Crystal Fragments,
White Mage's Staff, Sage's Nouliths, Astrologian's Planisphere — confirmed
exactly these 7 via `grep -rln "grantType\|equippedBySelf" cards/*/synergy.json
cards/*/progress.json`. All 7 real Forge citations checked directly
(`../mtg-forge/forge-gui/res/cardsfolder/{d,m,p,c,w,s,a}/*.txt`) — every
one is the SAME real static ability shape, `Mode$ Continuous | Affected$
Creature.EquippedBy | AddPower$/AddToughness$/AddType$ ...`
(`StaticAbilityContinuous.java` ~line 143-166/371-426 parse these,
~line 679-702/866-867 `addPTBoost`/`addChangedCardTypes` apply them at
layer SETPT/CHARACTERISTIC and layer TYPE respectively — this engine's own
simplified layers 7/4).

**Design (generalizes gap #14's own existing `continuousKeywordGrants`
mechanism, doesn't duplicate it)**: two new sibling `CardDefinition` fields,
`continuousPTGrants` (fixed `{power,toughness}` delta) and
`continuousTypeGrants` (creature-`subtypes` broadcast, e.g. 'Knight' — NOT
a card-TYPE change, deliberately distinct from Magitek Armor's own
self-only `animate`-based type change). All three grant families
(keyword/PT/type) now share ONE targeting shape, `card.ts`'s new
`ContinuousGrantTargeting` interface (`includeSelf`/`subtype`/
`onlyDuringYourTurn`/`equippedBySelf`), and ONE shared read-time resolution
function, `state.ts`'s new `qualifiesForContinuousGrant` — `effectiveKeywords`
was refactored to call it instead of re-implementing the same 4-field
check; `effectivePT` folds a qualifying `continuousPTGrants` delta in
alongside the existing CDA/counters computation; a new `effectiveSubtypes`
(exact mirror of `effectiveKeywords`) is the new read path for type grants,
now consulted by `wrapCard`'s `hasSubtype` instead of a raw
`card.subtypes.includes` read. `engine.ts`'s `resolveTop` and `state.ts`'s
`addCard` both copy the two new fields onto `RealCard`, same convention
`continuousKeywordGrants` already established (and same PRE-EXISTING
limitation: `harness.ts`'s own flat `Scenario[]` pipeline does NOT copy any
of the three grant families onto `RealCard` — only `engine.ts`'s real
`resolveTop` does — so a plain-harness-style card's own grant never
actually applies within ITS OWN scenario either, unaffected by this pass,
not newly introduced).

**Per-card real/not-real split, checked individually, NOT assumed
uniform** (this is the one place a blanket "all 7 get both fields" plan
would have been wrong):
- Fixed-delta P/T bonus, closable via `continuousPTGrants`: Dragoon's Lance
  (+1/+0), Paladin's Arms (+2/+1), Crystal Fragments (+1/+1), White Mage's
  Staff (+1/+1), Sage's Nouliths (+1/+0). **NOT** Machinist's Arsenal — its
  own "+2/+2 for each artifact you control" is a genuinely VARIABLE,
  board-state-SCALED bonus (real Forge `SVar:X:Count$Valid
  Artifact.YouCtrl/Times.2` on the SAME static ability) — `continuousPTGrants`
  is deliberately a plain fixed number pair, structurally can't represent
  this; stays real `staticAbilities` text only, a real, separate,
  still-open gap, same class as Gaelicat's/Magitek Infantry's own
  threshold-CDA gaps. Astrologian's Planisphere has no P/T clause at all.
- Type grant, closable via `continuousTypeGrants` (all fixed, no
  variability in any of these): Dragoon's Lance (Knight), Machinist's
  Arsenal (Artificer), Paladin's Arms (Knight), White Mage's Staff
  (Cleric), Sage's Nouliths (Cleric), Astrologian's Planisphere (Wizard).
  All 6 closed for real.

**Evidence, checked per-card scenario style, not assumed** (the "Ardyn vs.
Dion" distinction gap #14's own original closure established): 6 of the 7
cards' own `scenarios.ts` are plain `harness.ts` `Scenario[]` arrays with
no manual-log-injection field — their `pump`/`grantType` facts stay
evidence-exempted (now via two new SHAPE-scoped `verify-synergy.mjs`
functions, `isEquippedPTGrantFact`/`isEquippedTypeGrantFact`, replacing 11
old per-card-name lines). **Crystal Fragments is the one exception** — its
own `scenarios.ts` is a real `engine-trace.ts` pilot, so I added a genuine
`read:getNetPower` line right after the real `state.equip()` call
(Dwarven Castle Guard's printed 2/1 → live 3/2, confirmed in the
regenerated `trace.json`) — its own `pump` fact now has REAL trace
evidence, and the old name-scoped `isCrystalFragmentsEquippedPumpFact`
exemption is REMOVED outright (replaced with a NOTE comment documenting
the removal, same pattern the gap #8 closure's own removed exemption used
— not left as dead code). Also added `hasSubtypeReadEvidence` to
`verify-synergy.mjs` (the direct `effectiveSubtypes` analogue of the
pre-existing `hasKeywordReadEvidence`) — unexercised by any card today
(none of the 6 remaining grantType cards has an engine-trace pilot), but
real, wired plumbing for a future one, same "evidence checked first, shape
exemption is the fallback" precedent `isEquippedKeywordGrantFact` already
established. The generic `case 'read:getNetPower'` producedEvents branch
needed NO changes — it was already unconditional/reusable from Adelbert
Steiner's own original CDA closure.

**Tests**: `state.test.ts` — new `effectiveKeywords / effectivePT /
effectiveSubtypes` describe block, 9 real cases covering all 3 grant
families (subtype-matched unconditional grant, `onlyDuringYourTurn` on/off
for both keyword and P/T, a fixed P/T grant genuinely following a LIVE
re-equip, additive stacking with a +1/+1 counter, a type grant genuinely
following live re-equip, `wrapCard.hasSubtype` reading a granted type,
`includeSelf`+`subtype` targeting for a type grant proving the shared
helper isn't coincidental). Notable: NO prior unit test existed for
`effectiveKeywords`/`continuousKeywordGrants` AT ALL despite ENGINE_GAPS.md's
own "functionally verified" claim from the original gap #14 closure (that
verification was a throwaway script, never committed) — added real,
permanent coverage for that half too, not just the new P/T/type paths.

**Verification**: `npx vite-node functional-model/scripts/run-scenarios.mjs
--slug=<slug>` for each of the 7 (scoped, never unscoped — re-checked
`git status` first: confirmed a large amount of pre-existing, unrelated
concurrent-session work already sitting in the working tree — most of the
pool's `trace.json` files, several core files including card.ts/state.ts/
engine.ts/harness.ts/verify-synergy.mjs/synergy.ts/engine-trace.ts — but
NONE of it touched any of my 7 target cards' own logic in a conflicting
way; my `Edit` calls against the already-modified working tree all
succeeded cleanly, confirming no collision). `verify-synergy.mjs`: all 7
scoped → 0 hard failures (Crystal Fragments has pre-existing, unrelated
soft notes — tapForMana/drawCard/lore-counter/damage-prevention-grant —
none related to this closure); full pool → 317 checked, 0 hard failures.
`npx vitest run functional-model` → 325/325 (13 files). `npx tsc --noEmit`
→ 0 errors.

**ENGINE_GAPS.md gap #14 updated**: title broadened to "Continuous,
turn-conditional static keyword/P&T/type grants," the old "stays open"
paragraph replaced with the full closure writeup (design, 7-card split,
evidence-per-card, new tests) — see that file directly, not duplicated
here. `.claude/agent-memory/engine/notes.md` (this entry) is the fuller
verbose record; ENGINE_GAPS.md is the terse, doc-shaped summary.

**UI-side follow-up, documented not built (card-lane, per the task's own
explicit boundary)**: checked `app/components/ScenarioReplayTrace.vue`'s
actual `continuousGrantedKeywords()` directly rather than guessing its
shape. Real finding: it does NOT yet handle `equippedBySelf` grants AT
ALL, even for the PRE-EXISTING keyword case (Dragoon's Lance's own Flying
grant) — its own doc comment already documents this as a known, accepted
gap (`scenarioReplay.ts`'s own `equip` case doesn't record WHICH creature
an Equipment attached to). So the real follow-up is two-part: (1)
`scenarioReplay.ts` needs to start recording the real attachment target on
its `equip` case (a prerequisite for EITHER grant family, including the
already-shipped keyword one — not something my pass broke, it was already
missing), and (2) sibling `continuousGrantedPT()`/`continuousGrantedType()`
functions (mirroring `continuousGrantedKeywords()`'s own generic,
no-card-specific-branch shape) plus new `ScenarioReplayTrace.vue` props for
`continuousPTGrants`/`continuousTypeGrants` (mirroring the existing
`continuousKeywordGrants` prop). Engine-side data is fully ready for
either. Did NOT touch `ScenarioReplayTrace.vue`/`scenarioReplay.ts` myself
— out of lane, flagged for `card` instead (unlike a PRIOR engine-agent
pass, noted in this same file's own 2026-09-12 "Dion... live regression
report" entry, which DID cross-lane-touch this exact file directly and
flagged it after the fact — I did not repeat that pattern here since this
task's own instructions were explicit about staying in-lane for this
specific follow-up).

**Open Forge-verification still needed**: none — all 7 real cards' own
Forge scripts were read directly from `../mtg-forge`'s own cardsfolder
before writing any `continuousPTGrants`/`continuousTypeGrants` entry (see
citations above), not assumed from Scryfall oracle text alone.

## 2026-09-12 (later) — ENGINE_GAPS.md gap #13 closed for real: trigger-doubling ("Panharmonicon effect")

Built the real, general mechanism the standing writeup (re-confirmed twice
before today, both times correctly concluding "not narrow, don't build a
one-off") described needing: a shared chokepoint every trigger-firing call
site funnels through, plus a real, structured gate any card can declare.

**New vocabulary**: `card.ts`'s `TriggerDoublingGrant` (`CardDefinition
.triggerDoubling?: TriggerDoublingGrant[]`) — `scope` (`'selfAndAttached
Equipment'` / `'equippedSelf'` / `'anyPermanentYouControl'`), `causedBy`
(`'dying'` / `'entersBattlefield'`, optional), `entersMatch` (an OR-list of
`{isLand?, subtype?}` filters, only for the `entersBattlefield` cause).
`state.ts` re-declares the identical shape as a duck-typed `RealCard
.triggerDoubling` field (NOT imported from card.ts — state.ts's own header
is explicit it never imports card.ts, same as `continuousKeywordGrants`
already established) plus the real query-time check,
`shouldDoubleTrigger(state, firing, cause?)`.

**New file, `functional-model/triggers.ts`** — `fireTrigger(state, card,
ctx, actions, triggerName, cause?, onDoubled?)`, the ONE shared function
every trigger-firing call site now calls instead of `card.ts`'s
`resolveCard` directly. Deliberately its OWN file, not folded into
`state.ts` or `engine.ts` — `engine.ts` already has a real runtime VALUE
import from `saga.ts` (`{advanceSaga}`), so putting `fireTrigger` in
`engine.ts` would make `saga.ts` calling it back a genuine circular value
import (their existing cross-refs are all `import type`, erased at
compile time — this would be a REAL one). `triggers.ts` sits below both,
importing real values from `card.ts` (`resolveCard`) and `state.ts`
(`shouldDoubleTrigger`), nothing importing it back.

**All 6 real call sites migrated** (re-counted carefully while migrating,
not just re-trusting the old "6" from the standing writeup — turned out
engine.ts genuinely has 3 distinct trigger-dispatch sites, not 2: `playLand`'s
ETB, `resolveTop`'s ETB, AND `fireOnPhaseEnterTriggers`'s upkeep/end-step,
which the earlier assessment had folded into "engine.ts's two enter-trigger
sites" without separately counting the third): `stack.ts`'s `resolveTop`
(new optional `state` param, backward-compatible — every existing
plain-LIFO test still passes unchanged since it never passes `state`),
`engine.ts`'s 3 sites (the two ETB sites pass a real `{kind:
'entersBattlefield', entered:<the resolving/entering permanent itself>}`
cause — a permanent's own ETB genuinely CAN be "a permanent entering
causing a trigger," including its own, see Chocobo's scenario below;
upkeep/end-step passes no cause), `saga.ts`'s `advanceSaga` (no cause — a
lore-counter tick isn't caused by dying/entering), `harness.ts`'s scenario
runner (both `scenario.trigger` and `sequence`'s `trigger` step — ability/
activate dispatch stays on bare `resolveCard`, correctly, since doubling
only ever applies to a TRIGGERED ability, never activated),
`engine-trace.ts`'s `pilotFireTrigger` (gained a new trailing optional
`cause` param — every one of its ~14 existing real call sites across the
pool needed ZERO changes, purely additive).

**Causal-order trace logging** — `fireTrigger`'s `onDoubled` callback lets
a caller log its OWN second `{fn:'trigger',...}` bracket at the exact right
moment (right before the second round of effects, not both brackets
up-front) without duplicating `shouldDoubleTrigger`'s own logic in the
caller. Caught this ordering issue empirically (first draft logged both
brackets in the wrong place relative to the effects) by actually running
`run-scenarios.mjs` and reading the generated trace.json, not by inspection
alone — worth remembering as a general lesson for any future trace-logging
work: generate and read the actual output, don't just reason about it.

**All 3 real FIN cards wired, with real demonstrable doubling**:
- Cloud, Midgar Mercenary: `{scope:'selfAndAttachedEquipment'}`, no
  `causedBy`. Its own real combo scenario (cast Cloud, real ETB tutors
  Ultima Weapon, cast+equip it, real attack) now shows Ultima Weapon's own
  attack trigger firing TWICE — added a SECOND real opponent creature
  (Hill Gigas) since the doubled destroy needs two distinct legal targets.
- The Masamune: `{scope:'equippedSelf', causedBy:'dying'}` — granted via
  equip onto the wearer, same `equippedBySelf` recipient-resolution shape
  gap #14's Equipment grants already use. The "...or an emblem you own"
  half is genuinely, permanently unreachable (no emblem mechanism anywhere
  in this engine) — documented on the field itself, not silently dropped.
  New real combo scenario (replacing the old flat `harness.ts` one):
  equips a real Al Bhed Salvagers (already has its own real `onDies`
  trigger), which dies for real in lethal combat (Hill Gigas blocks,
  one-sided 704.5g) — its dying trigger, fired with a real `{kind:'dying'}`
  cause, doubles for real.
- Traveling Chocobo: `{scope:'anyPermanentYouControl', causedBy:
  'entersBattlefield', entersMatch:[{isLand:true},{subtype:'Bird'}]}` —
  applies to ANY permanent the controller owns, not just self (Chocobo has
  no named trigger of its own at all). New real scenario (replacing the old
  "no resolvable effect" placeholder) reuses Ambrosia Whiteheart (already
  has a real Landfall trigger) — a real land entering, fired with a real
  `{kind:'entersBattlefield', entered:<the land>}` cause, doubles Ambrosia's
  pump. **Real, unplanned, textually-correct find**: Ambrosia Whiteheart is
  HERSELF a Bird, so her own ETB (auto-fired by `engine.ts`, which now
  threads the identical cause through for a resolving permanent's own ETB)
  ALSO doubles — bounced 2 of the caster's own lands instead of 1. Kept,
  not "fixed" — this is real, correct MTG rules interaction (a card
  matching its OWN board-wide doubling grant's filter causes its own ETB to
  double), and it's a good, honest validation that the mechanism is
  genuinely general rather than special-cased to my one anticipated case.

**Tests**: new `functional-model/triggers.test.ts` (12 cases — baseline,
all 3 gate shapes doubling for real, and the negative "precondition
genuinely enforced" cases for each: Cloud's shape doesn't double
unequipped; Masamune's doesn't double with no/wrong cause or the wrong
creature; Chocobo's doesn't double a non-land/non-Bird cause or an
opponent's own permanent). `engine.test.ts`'s new `Trigger-doubling`
describe block (3 cases) proves the real `engine.ts` wiring end-to-end
(not just `triggers.ts`'s own pure logic tested in isolation): Cloud's own
ETB genuinely does NOT double via the real `castSpell`->`resolveTop` path
before he's equipped; a LATER real `fireOnPhaseEnterTriggers` auto-fire
DOES double once equipped; an unrelated permanent's own trigger does NOT
double even with Cloud equipped nearby. Caught one real test-authoring bug
myself while writing these: a second creature cast in the same
`engine.test.ts` fixture needs a mana cost the fixture's fixed 3-land board
can actually still afford after the FIRST spell already tapped out — gave
it `manaCost:''` rather than inventing more lands, since the test is about
trigger-doubling scope, not a second mana payment.

**verify-synergy.mjs**: had to add one new, real exemption —
`isTravelingChocoboAmbrosiaComboRead` (mirrors the pre-existing
`isCloudUltimaWeaponComboRead` exactly) — since Chocobo's own new combo
scenario reuses Ambrosia Whiteheart's own `read:getCardsIn` effect inside
Chocobo's own trace.json, which the reverse aggregate-read check otherwise
(correctly, structurally) flags against Chocobo's OWN synergy.json as an
unexplained read. This is a real, recurring structural situation (ANY
combo scenario reusing a different card's own effect hits it) — worth
remembering as a pattern, not a one-off: when a card's own `scenarios.ts`
imports and runs another real card's own `CardDefinition`/effects inside
ITS trace, `verify-synergy.mjs` needs a matching name-scoped exemption for
whatever aggregate reads that OTHER card's own effects perform, or the
combo card will hard-fail for a condition that isn't actually its own.

**Deliberately NOT done, flagged not decided**: no new SOURCE Fact
authored on any of the 3 cards' own `synergy.json` for the doubling EFFECT
itself (the CONDITION-side sink facts Cloud already had are untouched and
still pass). Cloud's own `progress.json` records the user's 2026-09-11
call not to author one; I didn't re-litigate that call, but didn't treat
it as permanently settled either now that real evidence exists — this sits
at the boundary between "engine mechanism" (mine) and "synergy fact
authoring" (per `.claude/agents/engine.md`'s own domain note, arguably
`card`'s lane, though ENGINE_GAPS.md's own history shows prior gap
closures — #7, #8, #14 — DID author matching facts in the same pass). Left
open rather than guessed at either direction.

**Verification**: `vitest run functional-model` → 340/340 (325 baseline +
12 `triggers.test.ts` + 3 `engine.test.ts`). `verify-synergy.mjs` scoped to
the 6 touched/reused cards (Cloud, Masamune, Chocobo, Ultima Weapon, Al
Bhed Salvagers, Ambrosia Whiteheart) → 0 hard failures; full pool (317
checked) → 0 hard failures. `tsc --noEmit` → unchanged pre-existing
baseline (48 errors, none in any file this pass touched — confirmed via
grep, not just eyeballing the count). Re-checked `git status` before
starting AND before every unscoped operation — the tree had (and still
has) a very large amount of concurrent, unrelated work in flight (most of
the card pool's own files, several shared core files); none of it
conflicted with anything this pass touched.

**Open Forge-verification still needed**: none for this gap specifically
— the general `S:Mode$ Panharmonicon` shape and Cloud's own exact citation
were already verified against the real shipped `cardsfolder.zip` in an
earlier pass (recorded in ENGINE_GAPS.md gap #13's own original writeup);
Masamune's and Traveling Chocobo's own oracle text was taken from
data/fin/fin_scryfall.json (already cross-checked against Forge once,
same earlier pass, per the gap's own "re-checked fresh" subsection) — this
pass only built the mechanism itself, not new card-text verification.

---

## Gap #4 CLOSED (2026-09-12) — target-legality locking + resolution-time re-validation/fizzle (CR 601.2c/608.2b)

Real design turned out SMALLER than ENGINE_GAPS.md's own prior assessment
("redesigning Effect's whole resolution model") once actually attempted —
worth remembering as a pattern: `card.ts`'s `applyEffect` already rebuilds
each targeted branch's own candidate `pool` from LIVE state at resolution
time (validType/owner/notSelf/etc. already applied) — that rebuild ALREADY
IS a CR 115 legality check, for free. The only real piece missing was a
way to PIN which object was chosen at cast time and re-check ITS
membership in that same pool instead of picking fresh. No Effect-model
redesign needed at all — just a new optional field threaded through, plus
one new shared helper.

**Mechanism** (see `card.ts`'s `EffectContext.declaredTargets` doc comment
for the fullest writeup, `resolveTargets`'s own doc comment for the helper
itself):
- `stack.ts`'s `StackObject` gained `declaredTargets?: Card[]` — the real
  object(s) locked in at cast/activation time. `resolveTop` UNCONDITIONALLY
  copies it onto `ctx.declaredTargets` right before resolving (clearing to
  `undefined` when absent — important: a resolved permanent's own `ctx` is
  REUSED across many later resolutions, e.g. repeated activated abilities,
  so a stale array from a PRIOR resolution must never silently leak
  forward into a later, unrelated one).
- `engine.ts`'s `castSpell`/`activateAbility` both gained a new
  `declaredTargets?: RealCard[]` param, wrapped via `state.ts`'s
  `wrapCard` before being pushed onto the `StackObject`. `castSpell`
  defaults `declaredTargets` to `[declaredTarget]` when the PRE-EXISTING,
  cost-reduction-only `declaredTarget` singular param is given instead and
  `declaredTargets` itself is omitted — Fate of the Sun-Cryst's real shape
  (a cost-reduction condition keyed on the SAME object the spell targets)
  is exactly why this default is safe, not just convenient: for every real
  FIN card checked, the cost-reduction target and the actual spell target
  are the same object. A future card where they genuinely differ would
  need the plural param explicitly.
- `card.ts`'s new shared `resolveTargets(pool, qty, ctx, actions)` is the
  ONE chokepoint 9 targeted-effect branches now call instead of a raw
  `chooseTarget` loop: `destroy`, `move`'s targeted branch,
  `putCounterTarget`, `dealDamageTarget`, `fightTarget`, `pumpTarget`,
  `grantKeywordTarget`, `tapTarget`, `untapTarget`. When
  `ctx.declaredTargets` is set: takes up to `qty` entries off the FRONT
  (FIFO, `.shift()`) that are STILL present in `pool` (compared by
  `getId()`, NOT object identity — `Player.getCardsIn` produces a FRESH
  wrapper `Card` object per call in this codebase, confirmed by checking
  `harness.ts`'s/`engine-trace.ts`'s own `loggingCard`), silently dropping
  — never replacing — any that aren't (608.2b: an illegal target is
  dropped, never substituted for a new pick). When unset: BYTE-FOR-BYTE
  the exact prior lazy loop (`chooseTarget(remaining, ctx.preferTarget)`
  per slot) — zero regression risk, confirmed by the full 349-test run
  (every existing scenario drives `card.ts` via `harness.ts`'s flat
  lifecycle, which never sets this field).
- FIFO consumption is shared across the WHOLE resolution (not reset per
  effect) on purpose — a card with more than one distinct targeted effect
  in the same resolution could still divide one declared-target list
  across them in cast order. No real FIN card needs this today; it's a
  free consequence of the design, not extra work.

**Real card demonstration**: `cards/fate-of-the-sun-cryst/scenarios.ts`
(the exact card ENGINE_GAPS.md's own task suggested) gained a third real
engine-piloted scenario — casts targeting the opponent's real Coeurl, then
Coeurl is destroyed by something else (`pilot.state.move` to Graveyard —
same "represent the real zone change directly, don't model which spell
caused it" technique crystal-fragments-summon-alexander's own scenario
already established for an off-card event) before the spell resolves. The
regenerated trace.json shows the spell still correctly resolving into its
owner's graveyard with NO `destroy` log line — contrast the other two
scenarios, which each log one — real, checkable evidence of the fizzle.
`progress.json`'s `review` reset from `"human"` back to `"ai"` (authored
scenarios.ts content changed — standing convention, not something to
re-litigate) with a short note appended (the pre-existing giant notes blob
from gap #7's earlier closure was left alone, not rewritten).

**Scope, precisely — what's real vs. what's deliberately NOT covered**
(see ENGINE_GAPS.md gap #4's own closure writeup for the authoritative
version, this is the short form):
1. `dealDamageAnyTarget` isn't wired to `resolveTargets` (mixes
   `Player`/`Card`, not the plain `Card[]` pool shape every other branch
   shares) — no real FIN card needs a demonstrated fizzle on it.
2. Cast-time itself is NOT legality-gated on the declared target (CR
   601.2c's stricter "can't even be put on the stack targeting something
   illegal" rule) — only resolution-time 608.2b re-validation is real. A
   cast at an already-illegal target still goes on the stack and correctly
   fizzles at resolution instead of being rejected up front — same
   real-game-visible outcome, one priority-round later. Would need each
   targeted `Effect` kind's own pool/validity logic exposed a layer higher
   (`canCastSpell`/`canActivateAbility`, which today have ZERO visibility
   into `card.effects`' targeting shape) — a real, separate, deliberately
   deferred extension.
3. Fizzle granularity is PER-EFFECT, not per-whole-resolution: a card with
   ONE targeted effect plus a separate genuinely-untargeted sibling effect
   (Eject's own real "return target nonland permanent to hand. Draw a
   card." shape) only skips the TARGETED effect on fizzle — the
   untargeted "draw a card" still runs. Strict CR 608.2b says the WHOLE
   spell fails to resolve once ALL its targets (every instance of the word
   "target," collectively) are illegal. Deliberately not built — would
   need a two-pass restructure of `resolveCard`'s own effects loop
   (compute every targeted effect's own legal-target survival BEFORE
   running ANY effect), and no real FIN card's own scenario exercises or
   depends on the stricter reading. `eject`'s own `scenarios.ts` is
   untouched by this pass (checked its own real shape — it's the exact
   card that WOULD need this distinction, flagged rather than silently
   assumed fine).
4. `activateAbility` got the same `declaredTargets` param for symmetry
   (602.1's "choose targets" is the direct analogue of 601.2c) and is
   covered by this pass's own unit tests, but no real FIN card's own
   scenario demonstrates a targeted ACTIVATED ability fizzling (Coeurl's
   own "tap target creature" is piloted directly via `resolveCard`, not
   through the real cast/stack path, in its own scenario) — real, tested
   machinery without its own `cards/*` demonstration.

**Tests**: `stack.test.ts`'s new `StackObject.declaredTargets` describe
block (5 cases: baseline legal-target destroy; fizzle via bounce to hand;
fizzle via outright destroy; multi-target partial fizzle — Fight On!'s own
real "up to two target creature cards" shape, one of two declared targets
dies before resolution, the other is still destroyed, a third untouched
bystander is never substituted in; the no-`declaredTargets`-at-all
backward-compatible case). `engine.test.ts`'s new describe block (4 cases)
is the same shape end-to-end through the real `castSpell`/`resolveTop`
pair instead of a bare `Stack` (baseline; fizzle via destroy; fizzle via
bounce; the no-`declaredTarget` backward-compatible case) — needed
`DESTROY_TARGET`'s own manaCost set to `{1}{G}` (not `{1}{W}`) purely so
`setupGame()`'s fixed 2 Forest + 1 Mountain board could afford it with no
extra per-test land setup; the cost's own color is irrelevant to what this
block tests.

**Verification**: `vitest run functional-model` → 349/349 (all green,
includes a large amount of other concurrent same-day work already landed
in the tree — not this pass's own tests, see below). `verify-synergy.mjs`
scoped to fate-of-the-sun-cryst → 0 hard failures (same soft notes as
before, +1 new expected `enters` note for scenario 3's own Coeurl setup);
full pool (317 checked, 4 skipped) → 0 hard failures. `tsc --noEmit -p
tsconfig.json` → zero NEW errors in any of the 4 files this pass touched
(`card.ts`/`stack.ts`/`engine.ts`/`engine-trace.ts`, confirmed via grep,
not eyeballing); the pre-existing baseline noise (`allowImportingTsExtensions`
config-shape errors across `cards/*/definition.ts`, 2 unrelated
`implicitly has an 'any' type'` errors in `doppelgang`/`elrond-moon-reader`,
1 unrelated `Actions.play` missing-property error in a `jill-shiva...`
card's own local `engine.test.ts`) is untouched, confirmed pre-existing via
`git stash`/`git stash pop` (56 errors stashed-baseline vs. today's much
larger uncommitted tree — see below for why that comparison needed care).

**A real note on concurrent work, for whoever reads this next**: this
session found `card.ts`/`engine.ts`/`stack.ts`/`engine-trace.ts`/
`ENGINE_GAPS.md`/most of `functional-model/cards/*` already showing as
locally modified (uncommitted) the moment any git command touched the
working tree — NOT edits made concurrently DURING this pass, but a very
large amount of uncommitted, ALREADY-LANDED work from earlier gap
closures the same day (gaps #5/#6/#7/#8/#8b/#11/#13, all visible already
in ENGINE_GAPS.md's own text when this pass started reading it fresh, per
the task's own instruction). Don't mistake a big `git status`/`git diff
--stat` for a live collision — check whether the content matches an
already-documented, already-closed gap (it did, every time, this pass)
before treating it as a coordination risk. Only ran `git stash`/`git stash
pool` ONCE, early, to isolate a `tsc` baseline — safe since it completed
cleanly with no conflicts, but risky enough (stashes the WHOLE repo's
uncommitted state, not just this pass's own files) that it's better to
avoid next time; `git diff --stat -- <files I touched>` is enough to
confirm my own edits landed without needing a full-repo stash.

**Open Forge-verification still needed**: none new — this gap is pure
engine-resolution-model mechanism, not new card-text. The real Forge CR
citations (601.2c/601.2h/608.2b/115) are core comprehensive-rules
mechanics, not card-script-specific, so there's no `cardsfolder.zip`/
oracle-text cross-check applicable here the way a keyword-grant or
cost-reduction gap would need. If a FUTURE pass wants full closure on the
3 remaining scope items above (cast-time 601.2c pre-check, whole-spell
608.2b fizzle granularity, a real `cards/*` demonstration of an activated-
ability fizzle), Coeurl's own real activated ability and Eject's own real
two-effect shape are already the right real cards to build against —
no further Forge/XMage lookup needed beyond what's already cited in
ENGINE_GAPS.md gap #4's own writeup.

## Scorpion Sentinel (fin/72) migration to unified Fact model (2026-09-12)

Migrated `cards/scorpion-sentinel/` to the unified Fact/annotations model.
This card is one of the two ORIGINAL real precedent cards (alongside
gigantoad) that gaelicat's/magitek-infantry's own progress notes and
verify-synergy.mjs doc comments already cited by name for the "threshold-
gated CDA, no ptFormula variant" gap class — now itself migrated for the
first time, following that same house style exactly (baseline self-cast/
self-enters, real `event:'pump'` SOURCE for the threshold pump exempted via
a new `isScorpionSentinelLandThresholdPumpFact`, a paired condition SINK
`{types:{has:['Land']},amount:{min:7}}` exempted via a new
`isScorpionSentinelLandThresholdWant` — both in `scripts/verify-synergy.mjs`,
mirroring `isMagitekInfantryArtifactThresholdPumpFact`/
`isMagitekInfantryArtifactThresholdWant`). Added to `ANNOTATED_CARD_SLUGS`
(`scripts/annotation-coverage.mjs`). Scenario converted from the old bare
no-op `Scenario` to a real `engine-trace.ts` pilot: 7 real basic lands (1
Island + 6 Plains, doing double duty as both the {1}{U} cast payment AND
the land-count threshold, no extra filler needed), a real aggregate
`getLandsInPlay()` read, cast, then a real `effectivePT` read honestly
showing the unmodified printed 1/4 (documents the gap rather than
fabricating the +3/+0). `definition.ts` needed no changes — `pt:[1,4]` and
the documentary `staticAbilities` text already predated this migration and
were already correct.

verify-synergy.mjs (scoped + full pool): 0 hard failures (317 v2 cards
checked pool-wide). `vitest run functional-model`: 349/349. find-synergies.mjs
before/after (isolated via a temp synergy.json swap+restore, not a stale
git-HEAD diff): 150 → 170 lines (+20) — all 150 "lost" bare
`battlefield presence` lines have an exact 1:1 relabeled replacement under
`enters the battlefield` (confirmed count-for-count); the 20 genuinely new
lines are real land-producing/Town cards now matching the new
`wants-lands` sink (Balamb Garden, Baron Airship Kingdom, Breeding Pool,
Capital City, Cavern of Souls, Clive's Hideaway, Crossroads Village,
Eclipsed Realms, Gohn Town of Ruin, Gongaga Reactor Town, Guadosalam
Farplane Gateway, Insomnia Crown City, Rabanastre Royal City, Sharlayan
Nation of Scholars, Starting Town, The Gold Saucer, Treno Dark City,
Vector Imperial Capital, Willowrush Verge, Windurst Federation Center).

**Open Forge-verification still needed**: none — same as Gaelicat/Magitek
Infantry, this is the same already-documented threshold-CDA engine gap
(ENGINE_GAPS.md doesn't list it as newly open; it's covered under the
existing layers.ts 613 simplification note), not new card-text needing a
fresh Forge cross-check. gigantoad remains the one still-unmigrated sibling
card with this identical gap shape, not touched by this task (out of
scope).

## Swallowed by Leviathan (fin/79) — brand-new card, authored fresh (2026-09-12)

`functional-model/cards/swallowed-by-leviathan/` didn't exist; authored end
to end following the `ether` (fin/53) template. Real oracle text ({2}{U}
Instant): "Choose target spell. Surveil 2, then counter the chosen spell
unless its controller pays {1} for each card in your graveyard. (To
surveil 2, ...)"

Both real effects reuse already-promoted vocabulary, zero new engine work:
`kind:'surveil'` (promoted by dreams-of-laguna/il-mheg-pixie/matoya-archon-
elder) and `kind:'counter'` (promoted by louisoix-s-sacrifice, log-only
CounterEffect — no stack/object model exists to actually remove a target
from). 4 SOURCE + 0 SINK facts (self-cast/self-graveyard baseline, surveil,
counter), all real-annotated via `compute-annotations.mjs` (hand-computed
offsets matched the baked ones exactly, confirming the manual approach is
sound). Added to `ANNOTATED_CARD_SLUGS`.

**Checked for the Syncopate (fin/80) sibling precedent per instruction — it
did not exist in the pool at authoring time** (no `cards/syncopate/`
directory), so no borrowed treatment was available. **Confirmed, don't
relitigate**: "counter unless pay {N}" has NO real mechanical treatment in
this engine — grepped `card.ts`/`engine.ts` for `unless`/`payOrElse`/
`optionalPay`/`payCost`: no such branching primitive exists anywhere.
`priority.ts`'s own header already documents "no AI / player decision
process" as a general accepted simplification — every choice is supplied by
the calling harness, never decided by the engine itself — so a genuine
mid-resolution "does the opponent pay" choice can't be a real conditional
branch. Modeled as an honest, single UNCONDITIONAL `counter` effect whose
`describe` carries the full real tax clause as text (same "log real intent,
simplify real branching" treatment other `describe`-only effects get) —
documented as a real, permanent knownGap, not silently glossed over. Any
future Syncopate authoring (or an engine extension adding a real optional-
payment primitive) should revisit this card too.

1 scenario (plain `harness.ts` style, same as louisoix-s-sacrifice/ether —
no real targetable object needed since `counter`'s target is abstract/
log-only): cast → surveil 2 → counter → move to graveyard, trace order
matches real oracle-text order.

Verification: `verify-synergy.mjs` scoped 0 hard failures/0 notes; full
pool (319 v2 cards) 2 pre-existing hard failures (sahagin,
valkyrie-aerial-unit — unrelated, other concurrent sessions' work; a
sibling agent also added 'ahriman' to `ANNOTATED_CARD_SLUGS` mid-task,
left untouched per the "note but don't revert" convention). `vitest run
functional-model`: 349/349. `tsc --noEmit`: 0 errors. `find-synergies.mjs`
(brand-new card, no HEAD version to diff): 14 real interaction lines — 13
via the self-graveyard baseline (unconstrained Graveyard-presence sinks:
Cantankerous Keepers, Eden Seat of the Sanctum, Elixir, Emet-Selch
Unsundered, Ignis Scientia, Magic Pot, Qutrub Forayer, Rydia's Return,
Sorceress's Schemes, Summon: Esper Ramuh, The Emperor of Palamecia,
Thranduil Sindarin Liege, Vanille Cheerful l'Cie), plus 1 via the promoted
surveil vocabulary (Matoya, Archon Elder). Zero matches for
`event:'counter'` — expected, same 0-match outcome louisoix-s-sacrifice's
own counter fact produced (no payoff card wants a countered-spell event
yet).

**Open Forge-verification still needed**: none for this card's own two
modeled effects (surveil/counter are both already-verified promoted
vocabulary, cited against real Forge source when first promoted). The
documented "counter unless pay" gap is a genuine engine-primitive gap, not
a card-text/Forge-citation question — nothing to re-verify against Forge
source there, only an engine extension (a real optional-payment/decision
primitive) would close it, and that's a design decision, not a citation
lookup.

## Valkyrie Aerial Unit (fin/84) migrated to the unified Fact model (2026-09-12)

Real oracle text (Scryfall-confirmed, collector_number 84, `{5}{U}{U}`,
Artifact Creature — Construct, 5/4): "Affinity for artifacts (This spell
costs {1} less to cast for each artifact you control.) / Flying / When
this creature enters, surveil 2." Was previously a genuine gap — empty
`synergy.json` (0 facts either role, `verifySynergy: "empty"`), the sibling
verify-synergy full-pool run in the entry immediately above this one still
lists it as a hard failure written by another concurrent session before
this task fixed it.

3 SOURCE facts, 0 SINK: baseline `self-cast` (`{event:'cast', from:'Hand',
target:'self'}`) / `self-enters` (`{event:'entersBattlefield',
to:'Battlefield', controller:'you', subject:'self', target:'self'}`), both
typeLine-anchored on "Creature" — same real type line ("Artifact Creature
— Construct") AND identical anchor indices `[9,17]` as Rook Turret's own
pair, confirmed by direct comparison rather than recomputed by hand. Real
ETB `{event:'surveil', controller:'you'}`, oracle-anchored on "surveil 2"
— reused already-promoted vocabulary verbatim (dreams-of-laguna/
il-mheg-pixie/matoya-archon-elder), zero new engine work. Bare printed
Flying (`keywords: ['Flying']`) gets no fact, per the standing rule (this
engine's Flying is mechanically inert — nothing in the vocabulary
constrains on it).

**Affinity for artifacts — resolved the same real mechanism question as
Travel the Overworld's own "Affinity for Towns" (fin/82, explicitly flagged
as the same batch/sibling card to check).** Checked that sibling card's
OWN current on-disk state before deciding anything unilaterally: **it
hasn't actually been migrated yet either** — still a plain, empty
`synergy.json` (`"source": [{"zone":"Graveyard", ...}]` stray/unmigrated,
no baseline facts, no annotations) with Affinity kept purely as
`staticAbilities` free text and its own header comment already reasoning
"no cost-reduction machinery exists ... same treatment fate-of-the-sun-
cryst's own ReduceCost static already gets." So "the sibling's own
conclusion" to reuse is that pre-existing documentary-only treatment
itself, not a completed migration decision to copy — Valkyrie's own
`definition.ts` already carried the identical comment/header before this
task touched it (word-for-word mirroring travel-the-overworld's own,
presumably authored by an earlier pass), confirming this was already the
agreed direction, not something this task invented fresh.

Independently re-verified against `ENGINE_GAPS.md` gap #7's own CURRENT
text (re-read fresh, not from memory) rather than just trusting the
comment: gap #7 has had THREE real 2026-09-12 closures today
(fate-of-the-sun-cryst's target-conditional fixed-`{2}` `CostReduction`,
the-wind-crystal's flat unconditional BROADCAST `SpellCostReductionGrant`,
qiqirn-merchant's board-counted `ActivationCostReduction` on an activated
ability's cost) — but the doc's own text is explicit that the CAST-side
board-state-COUNTED shape (Affinity's exact shape: "costs {1} less ... for
each X you control", applied to THIS spell's own cast, not an activated
ability) is still NOT modeled: `CostReduction.amount` stays a plain fixed
number, no `Computed`-style board-counted hook exists for the cast-cost
path, and the gap doc names this exact asymmetry itself ("no real cast-side
FIN card needs a variable cast discount today" — Travel the Overworld and
Valkyrie are precisely the two real FIN cards that would, and neither is
closed). Kept as `staticAbilities` text, no Fact of either role — checked
one more precedent before finalizing: even qiqirn-merchant's own CLOSED,
engine-executed board-counted ACTIVATION discount got no "wants Towns you
control" SINK fact for the bare theme signal (`synergy.json` has 0 sink
facts) — so Valkyrie's still-OPEN cast-side case getting no SINK fact
either is consistent with, not a departure from, how the pool already
treats the closed sibling case.

Scenario consolidated to 1: dropped the old top-level `trigger: 'onEnter'`
shortcut (gave zero cast/enters evidence) for `sequence: ['onEnter']` after
a real cast->resolve->enters lifecycle, same rook-turret/cloudbound-moogle/
dwarven-castle-guard consolidation; `...keywordScenarios(valkyrieAerialUnit)`
kept (currently empty — Flying inert, not Legendary — same template-call
convention rook-turret/il-mheg-pixie already follow despite it adding
nothing yet). `trace.json` regenerated via `run-scenarios.mjs
--slug=valkyrie-aerial-unit`.

Did NOT attempt to stage "artifacts on board" in the scenario to gesture at
the Affinity discount — the task's own instruction was conditional ("if
achievable"), and it genuinely isn't: no engine hook reads board-state
artifact count against this card's own cast cost at all, so any such setup
would be inert scenery, not real demonstrated behavior, the same
"correctness over match count / no decorative setup" discipline this
project holds elsewhere.

Added `valkyrie-aerial-unit` to `ANNOTATED_CARD_SLUGS`
(`scripts/annotation-coverage.mjs`) — a concurrent session had appended
`ahriman`/`sahagin`/`stuck-in-summoner-s-sanctum` to the same array between
my read and my edit; re-read and appended after the current tail rather
than reverting, per the "note but don't revert" convention.

**Verification**: `compute-annotations.mjs valkyrie-aerial-unit` → 3/3
facts annotated, baked offsets matched hand-computed ones exactly (typeLine
[9,17]="Creature" both baseline facts; oracle line 2 [27,36]="surveil 2").
`compute-weights.mjs --slug=valkyrie-aerial-unit` → all 3 facts get
`value:1` (real trace evidence for every one). `verify-synergy.mjs` scoped:
0 hard failures. Full pool (319 v2 checked, 3 skipped v1-shaped): 1
pre-existing hard failure (`sahagin`, unrelated, mid-edit by a concurrent
session). `npx vitest run functional-model`: 349/349 (includes
`annotation-coverage.test.ts`: 5/5). `find-synergies.mjs`: BEFORE 0 lines
(synergy.json was genuinely empty pre-migration), AFTER 151 lines — 150 new
"enters the battlefield" matches via the baseline `self-enters` fact (the
pool's ~150 unconstrained Battlefield-presence sinks, same generic gain
every first-time migration produces) + 1 new "surveil" match (Matoya,
Archon Elder's own `onSurveil`-consuming want). Zero lost (nothing existed
to lose). `tsc --noEmit -p functional-model/tsconfig.json`: pre-existing
baseline errors only (import-path `.ts`-extension complaints on unrelated
files, a `.mjs`-import declaration-file gap on `scenario-card-names.test.ts`),
none in any file this task touched.

**Open Forge-verification still needed**: none — real oracle text confirmed
directly against `data/fin/fin_scryfall.json` (collector_number 84); this
pass is a fact-model/vocabulary migration only, no new engine mechanics.
Affinity's own cast-side board-counted `CostReduction` extension remains
real, open future engine work (ENGINE_GAPS.md gap #7), shared with Travel
the Overworld — whichever card migrates it first should build the general
hook, not a one-off per-card patch.

## Ahriman (fin/87) migrated from v1 (bare zone/excludeSelf patch) to unified Fact model (2026-09-12)

"Flying, deathtouch / {3}, Sacrifice another creature or artifact: Draw a
card." Bare printed Flying/Deathtouch: no facts (standing rule). 2 baseline
SOURCE facts (self-cast Hand, self-enters Battlefield, both typeLine-
anchored "Creature") + 2 real ability SOURCE facts + 1 real SINK, replacing
the old v1 file's presence-shaped Graveyard source (banned — asserted a
movement this engine's `activateAbility`/`unsupportedCostComponent`
genuinely DOES execute, so unlike Zack Fair/Qiqirn Merchant's own
documentary-only NAMED self-sacrifice, this one has real trace backing) and
its bare unconstrained `{event:'dies', controller:'you', value:4}` fact.

**Closest real pool precedent found and followed, not invented from
scratch**: `louisoix-s-sacrifice` (fin, "Sacrifice a legendary creature or
pay {2}... counter target...") is the one other real card that sacrifices
ANOTHER permanent (not itself) as a cost/effect. It merges the ACT with real
inline zone data on ONE fact (`{event:'sacrifice', from:'Battlefield',
to:'Graveyard', controller:'you', target:{types:{...}}, targeted:true}`) —
no separate `dies`-shaped consequence fact — because sacrificing is
unconditional (CR 701.16, no regeneration/indestructible-style prevention,
unlike `destroy`) and, for a sacrifice targeting something OTHER than the
card's own self, there's no pre-existing standalone zone-consequence fact
(like Zack Fair's own `self-graveyard`) it would otherwise duplicate — so
inline zone data on the ACT itself is correct here, not deferred to a
sibling fact (see the ACT-vs-CONSEQUENCE standing rule in
SYNERGY_DESIGN.md). Ahriman's own sacrifice fact copies this shape exactly,
substituting its own real target constraint: `target:{types:{hasAny:
['Creature','Artifact']}, excludeSelf:true}` (the real `Constraints.
excludeSelf` field, 2026-09-12) for Louisoix's `types:{has:['Legendary',
'Creature']}`. `targeted:true` also copied — the player genuinely chooses
WHICH creature/artifact to sacrifice among legal candidates, same reasoning
Louisoix's own precedent already established for this exact "choose which
permanent to feed the cost" shape (distinct from CR 601.2c spell/ability
targeting, but the same "real choice vs. broadcast" axis `targeted` tracks).
Plus a separately-anchored `{event:'drawCard', controller:'you'}` fact for
the ability's actual payoff.

**Real, caught-mid-task mistake, corrected before finishing**: a first pass
dropped the SINK fact entirely (reasoning: "the `excludeSelf`/type
constraint already lives on the sacrifice fact's own `target`, so a
separate SINK would be redundant"). Wrong — re-checked
`louisoix-s-sacrifice`'s own full file and it keeps BOTH: its own SOURCE
sacrifice fact's `target` constraint AND a separate SINK
(`{to:'Battlefield', controller:'you', types:{has:['Legendary',
'Creature']}}`) declaring "wants a legendary creature present" — these are
NOT the same claim from two matcher directions: the SOURCE target
constrains what Ahriman itself acts on once something is already on the
battlefield; the SINK is a real want that some OTHER card's own zone/ETB
SOURCE fact can satisfy (fodder-production support). Restored Ahriman's own
SINK (`{to:'Battlefield', controller:'you', types:{hasAny:['Creature',
'Artifact']}, excludeSelf:true}`), same shape the pre-migration v1 file
already had (just `zone`→`to` folded, annotations added) — this is the one
concrete case in this task where NOT blindly trusting a "looks redundant"
instinct against real precedent mattered.

**Annotations**: added `ahriman` to `ANNOTATED_CARD_SLUGS`
(`annotation-coverage.mjs` — noted a concurrent session had ALSO added it,
plus `sahagin`/`valkyrie-aerial-unit`/`stuck-in-summoner-s-sanctum`,
between my read and edit; re-read and appended rather than reverting, same
"note, don't revert" convention this file already uses elsewhere for
concurrent-edit collisions). New `cards/ahriman/annotations-authoring.json`
(2 typeLine entries for the baseline pair, 2 oracle entries for the
sacrifice+drawCard pair sharing one `sourceText` line, 1 oracle entry for
the sink, same `sourceText`/`highlight` as the sacrifice fact). Ran
`compute-annotations.mjs ahriman` — 5/5 facts annotated, baked offsets
verified by hand: typeLine `[0,8]`="Creature" (both baseline facts, "Creature
— Eye Horror"), oracle line 1 `[5,43]`="Sacrifice another creature or
artifact" (sacrifice source AND the sink, same span), oracle line 1 `[45,
56]`="Draw a card" (drawCard).

**Verification**: `verify-synergy.mjs` scoped → 0 hard failures, 0 soft
notes. Full pool (318 v2 checked, 4 skipped v1-shaped): 1 pre-existing hard
failure (`sahagin`, unrelated, mid-edit by a concurrent session — confirmed
via `git status`, not caused by this task). `vitest run functional-model`:
349/349. `find-synergies.mjs` before/after (isolated via a real
old-v1-file/new-file synergy.json swap, not a stale HEAD diff — same
technique this doc's other same-day entries use given a noisy concurrent
working tree): **lost** 9 real matches (the old banned unconstrained
`{zone:'Graveyard'}` presence fact's own type-unconstrained Graveyard-
presence sinks — Cantankerous Keepers, Eden Seat of the Sanctum, Emet-Selch
Unsundered, Ignis Scientia, Magic Pot, Qutrub Forayer, Rydia's Return,
Thranduil Sindarin Liege, Vanille Cheerful l'Cie) + 7 real matches (the old
unconstrained `{event:'dies'}` fact's own event-shaped `dying` sinks —
Aerith Gainsborough, Dwarven Castle Guard, Judge Magister Gabranth, Magic
Pot, Sephiroth Fabled SOLDIER, Undercity Dire Rat, Zodiark Umbral God —
lost because the new merged fact is named `event:'sacrifice'`, not
`event:'dies'`, same accepted event-name divergence `louisoix-s-sacrifice`'s
own precedent already established, not a fresh regression this task
introduced). **Gained**: the SAME 9 Graveyard-presence cards re-match, now
via the new real `sacrifice` fact's own zone data (`from:'Battlefield',
to:'Graveyard'`, displayed as "dies" via `zoneMovementName`) — net zero for
those 9, but now backed by a real movement fact instead of a banned
presence one; 139 genuinely new "enters the battlefield" matches via the
new baseline `self-enters` fact (this card had zero baseline facts before);
1 new self-interaction (`second-copy` — a second physical Ahriman entering
later genuinely satisfies its own "another creature/artifact" SINK want,
correctly NOT `same-instance`, confirming `excludeSelf` isn't accidentally
suppressing this legitimate different-object case).

**Open Forge-verification still needed**: none — real oracle text confirmed
directly against `data/fin/fin_scryfall.json` (collector_number 87, mana
cost `{2}{B}`, type line "Creature — Eye Horror", matches `definition.ts`
exactly). This pass is a fact-model/vocabulary migration only; the
underlying sacrifice-cost mechanics (`unsupportedCostComponent`'s "Sacrifice
another/a/two X" acceptance) were already real, working engine code before
this task, unchanged here.

### Sahagin (fin/71) migrated to the unified Fact/annotations model (2026-09-12)

Real oracle text confirmed against `data/fin/fin_scryfall.json` #71 AND the
real Forge card script (`tmp/mtg-forge/forge-gui/res/cardsfolder/s/
sahagin.txt`): `{1}{U}` Creature — Merfolk Warrior, 1/3, "Whenever you cast
a noncreature spell, if at least four mana was spent to cast it, put a
+1/+1 counter on this creature and it can't be blocked this turn." Forge:
`T:Mode$ SpellCast | ValidCard$ Card.nonCreature | ValidSA$ Spell.ManaSpent
GE4 | Execute$ TrigPutCounter`, `SVar:DBUnblockable:DB$ Effect | ... |
StaticAbilities$ Unblockable`.

**Read SYNERGY_DESIGN.md + ENGINE_GAPS.md fresh first, per the dispatch.**
Two "did today's closures affect this card" questions had concrete answers,
both confirmed by grepping the engine source rather than assumed:

1. **"If at least four mana was spent" — is there real mana-spent tracking
   now (cost-reduction hook, Prima Vista/Qiqirn work)?** No. Grepped
   `functional-model/*.ts` for `manaSpent`/`spentMana`/`totalManaSpent`/
   "mana spent": zero hits. Checked `StackObject`/`EffectContext`/`RealCard`
   for any "amount actually paid" field: none — `payMana` only returns
   which `RealCard` sources were tapped, never a total. This is a
   structurally DIFFERENT thing from today's real cost-REDUCTION closures
   (`CostReduction`/`ActivationCostReduction`/`SpellCostReductionGrant`,
   `effectiveCastCost`/`effectiveActivationCost`, ENGINE_GAPS.md gap #7) —
   those compute what's OWED before payment; none of them record what was
   actually SPENT paying it. Confirmed by reading The Prima Vista's own
   fin/64 migration (today, same session pool, `cards/the-prima-vista/
   progress.json`) — it hit the exact same real card shape
   ("...if at least four mana was spent to cast it...") and reached the
   identical conclusion independently; re-verified rather than assumed to
   transfer. **Convention followed** (same as Prima Vista, Ultros, Namazu
   Trader's own "if you do"): the trigger firing at all (via a real
   `sequence` step, not a top-level `trigger:` — see below) stands in for
   the untracked condition having been met.
2. **"Can't be blocked this turn" — is there real vocabulary now?** Yes,
   already real (not new this task, but newly load-bearing for THIS card):
   `Keyword` includes `'Unblockable'` (checked by `engine.ts`'s `canBlock`/
   `declareBlockers`), `grantKeywordSelf`/`grantKeywordTarget`/
   `grantKeywordAll` all support an opt-in `untilEndOfTurn` (real 514.2
   Cleanup expiry via the existing `untilEndOfTurnKeywordGrants` mechanism).
   Sahagin's old `custom` no-op (predating both) is now a real
   `{kind:'grantKeywordSelf', keyword:'Unblockable', untilEndOfTurn:true}`
   effect — mechanically checked, not documentary.

**Trigger renamed** `onNoncreatureSpellCast` -> `onCastNoncreatureSpell4Mana`
— reused The Prima Vista's own identical name/convention for the identical
real condition (`ValidSA$ Spell.ManaSpent GE4`) rather than inventing a
differently-worded name for the same real thing; `TRIGGER_EVENT_MAP`
already maps this name to `'cast'` (added for Prima Vista), so this card's
new sink gets the same real trigger-name evidence for free — no new map
entry needed.

**5 facts.** Source (text-order): (1)/(2) baseline self-cast(Hand)/
self-enters, typeLine-anchored ("Creature"); (3) real
`{event:'putCounter', counterType:'+1/+1', target:'self'}` (already real
before this pass, unchanged mechanically); (4) NEW real
`{event:'grantKeyword', keyword:'Unblockable', target:'self',
untilEndOfTurn:true}` (see above — no `controller` field, matching the
"self-target facts omit `controller`, it's a redundant restatement"
convention Zack Fair's own self `putCounter` fact and Adelbert Steiner's/
Ambrosia Whiteheart's own self `pump` facts already establish; no
`targeted` either — `target:'self'` is a single fixed thing, no real bucket
of candidates to have chosen among, same convention). Sink (1): reused
The Prima Vista's own exact vocabulary — `{event:'cast', controller:'you',
target:{types:{not:['Creature']}, cmc:{min:4}}}` — rather than inventing a
new shape for the identical real condition clause.

**Scenario CHANGED (still 1, per "default 1, real basic function").** The
old scenario used a top-level `trigger:'onNoncreatureSpellCast'`, which
skips harness.ts's real cast->stack->enters lifecycle entirely (`selfZone`
starts directly on the Battlefield for a top-level `trigger`) — this would
leave the new baseline self-cast/self-enters facts with ZERO trace
evidence, since Sahagin has no `activationCost` and so doesn't qualify for
the Vehicle/Equipment-scoped `isActivationCostPermanentBaselineFact`
exemption Prima Vista's own baseline facts lean on instead. Fixed the same
way minwu-white-mage's own scenario already fixed the identical problem:
dropped the top-level `trigger`, used `sequence:
['onCastNoncreatureSpell4Mana']` instead — lets the real cast/enters
lifecycle run first, then fires the named trigger once Sahagin is
genuinely on the battlefield, still exactly one scenario. Now backs cast,
entersBattlefield, putCounter, AND the real grantKeyword fact all with one
real trace (previously only putCounter had any evidence at all).

**Annotations**: added `sahagin` to `ANNOTATED_CARD_SLUGS`
(`annotation-coverage.mjs` — a concurrent session had already appended
several other slugs to the same list between read and edit; re-read and
appended after the concurrent additions rather than reverting, same
"note, don't revert" convention this file's own Ahriman entry above
already established for this exact kind of collision). New
`cards/sahagin/annotations-authoring.json` (2 typeLine entries for the
baseline pair, sharing "Creature — Merfolk Warrior"/"Creature"; 2 oracle
entries for putCounter/grantKeyword, each pointing at its own real clause
in the single-sentence oracle text; 1 oracle entry for the sink, matching
the trigger's own condition clause). Ran `compute-annotations.mjs sahagin`
— 5/5 facts annotated; baked offsets verified by hand before running:
typeLine `[0,8]`="Creature" (both baseline facts), oracle line 0 `[83,119]`
="put a +1/+1 counter on this creature", oracle line 0 `[124,153]`="it
can't be blocked this turn", oracle line 0 `[0,81]`="Whenever you cast a
noncreature spell, if at least four mana was spent to cast it" (sink) —
all matched the script's own computed output exactly.

**Verification**: `verify-synergy.mjs` scoped -> 0 hard failures, 0 soft
notes. Full pool (318 v2 checked, 4 skipped v1-shaped): 3 pre-existing hard
failures (`black-mage-s-rod`, `stuck-in-summoner-s-sanctum`,
`ultros-obnoxious-octopus`), all confirmed via `git status` as concurrent
peer-session in-flight migrations whose own working-tree diffs don't touch
`sahagin` or its new vocabulary. `vitest run functional-model`: 349/349.
`find-synergies.mjs` diff (isolated via a real git-HEAD swap of just this
card's own 4 files — `definition.ts`/`scenarios.ts`/`synergy.json`/
`trace.json` — restored immediately after; confirmed byte-identical restore
via `diff` and re-verified `verify-synergy.mjs sahagin` still OK afterward):
**0 -> 139 lines, ALL inbound** (`Sahagin --[enters the battlefield]-->` X),
entirely via the new `self-enters`/`to:'Battlefield'` baseline fact
matching real pool permanent-producing sinks pool-wide (same "baseline
vocabulary now real" shape every freshly-migrated plain creature shows).
Zero outbound matches for the new putCounter/grantKeyword/cast-sink
vocabulary — same, already-documented "vocabulary now real, matched later"
situation The Prima Vista's own identical cast-sink is in (no other pool
card's SOURCE fact currently satisfies a noncreature/cmc-4+ cast want). The
OLD card (bare putCounter-self source, empty sink) had 0 matches in either
direction before this migration — confirmed via the same git-HEAD swap,
not assumed.

**Open Forge-verification still needed**: none for this pass — real oracle
text and the real Forge script both confirmed directly (citations above).
The one still-open item is the mana-spent-tracking gap itself (documented
in `progress.json.knownGaps`, same as The Prima Vista's) — not something
this migration could close, a real, separate future engine task if ever
prioritized (would need real CR 601.2h/706-territory payment-amount
tracking threaded from `payMana` through `StackObject` to `EffectContext`,
a materially bigger lift than this task's own scope).

## Al Bhed Salvagers (fin/88) migrated to the unified Fact model (2026-09-12)

Oracle (verified against `data/fin/fin_scryfall.json` #88): "Whenever this
creature or another creature or artifact you control dies, target opponent
loses 1 life and you gain 1 life." Creature — Human Artificer Warrior,
{2}{B}, 2/3. `definition.ts` was already correct/unchanged (a single
`onDies` trigger, `loseLife owner:'opponents'` + `gainLife`) — only
`synergy.json`/`annotations-authoring.json`/`scenarios.ts`/`progress.json`
needed migrating.

**Confirmed before starting**: this card was already used as The Masamune's
own real trigger-doubling combo scenario (`cards/the-masamune/scenarios.ts`)
— that trace is written to `cards/the-masamune/trace.json` only
(`run-scenarios.mjs` only ever runs a card's OWN `scenarios.ts`), so this
card's own `trace.json` still needed independent real evidence; factored
into scenario design (mirrored the SAME real one-sided lethal-combat-vs-
Hill-Gigas death this Masamune scenario already establishes, rather than
inventing a different board).

**Sink modeled per explicit instruction, NOT `excludeSelf`**: unlike
G'raha Tia's real "another creature or artifact you control dies"
(`excludeSelf: true`), this card's own trigger condition is "this creature
OR another creature or artifact ... dies" — self genuinely qualifies too,
so the sink is a plain `{event:'dies', controller:'you',
target:{types:{hasAny:['Creature','Artifact']}}, value:1}` with no
`excludeSelf`. Also authored the baseline self-cast/self-enters pair PLUS a
third baseline `self-dies` SOURCE fact (`subject:'self', target:'self'`) —
matching the established convention every other onDies-triggered migrated
card in the pool already uses (dwarven-castle-guard, aerith-gainsborough,
G'raha Tia all author their own death as BOTH a SOURCE fact for other
cards' payoffs AND the trigger's own SINK condition) — not explicitly
asked for in the task's own rule list, but consistent with precedent and
needed for real trace evidence to exist at all for the "self dies" half of
the sink.

**`lifeloss`/`lifegain` vocabulary**: both already real, established pool
vocabulary (11+ other cards use `event:'lifeloss'`/`'lifegain'`,
`state.ts`'s real `loseLife`/`gainLife` on `RealPlayer`,
`verify-synergy.mjs`'s `case 'loseLife'`/`case 'gainLife'` producedEvents
branches) — no new vocabulary needed. Added `targeted: true` on the
`lifeloss` fact (a NEW annotation for this specific fact, no other pool
`lifeloss` fact sets it yet) since the printed text genuinely says "target
opponent" (CR 601.2c) — `lifeloss`'s own `controller` field is the
established exception that names the recipient (not a `recipient`/`target`
bucket), but the doc comment's own broader `targeted` convention ("a Side
that can plurally include more than one player") still applies to a
multi-opponent game even though this engine only ever models 2 players.

**Offsets** (typeLine "Creature — Human Artificer Warrior", oracle "Whenever
this creature or another creature or artifact you control dies, target
opponent loses 1 life and you gain 1 life."): typeLine `[0,8]`="Creature"
(self-cast/self-enters, same convention as every other plain non-Legendary
creature migrated so far); oracle `[0,71]`="Whenever this creature or
another creature or artifact you control dies" (self-dies SOURCE and the
sink, same clause backing both); `[73,101]`="target opponent loses 1 life";
`[106,121]`="you gain 1 life". Ran `compute-annotations.mjs
al-bhed-salvagers` — 6/6 facts annotated, computed offsets matched hand
verification exactly.

**scenarios.ts rewritten** from the old flat `{trigger:'onDies',
opponents:[{}]}` `harness.ts` shortcut (skips cast/enters lifecycle
entirely, produced zero evidence for the new baseline facts) to a real
engine-piloted trace: cast ({2}{B}, real mana payment) -> resolve -> real
turn passage -> real one-sided lethal combat vs. Hill Gigas (5/4, same real
card The Masamune's own scenario already uses as this card's blocker) ->
704.5g SBA death -> `onDies` fired manually (no auto-fire exists anywhere
in this engine for a `dies`-class trigger). Real trace confirms `cast`,
`enters`, `destroy`, `loseLife amount:1`, `gainLife amount:1` log lines.

**Verification**: `verify-synergy.mjs al-bhed-salvagers` -> 0 hard failures
(soft notes only: tapForMana/drawCard/untap/tap/attack/block/dealDamage —
same generic combat-scaffolding noise every engine-piloted scenario
produces). Full pool: 3 pre-existing hard failures unrelated to this card
(`black-mage-s-rod`, `stuck-in-summoner-s-sanctum`,
`ultros-obnoxious-octopus`) — confirmed these are concurrent peer-session
in-flight migrations (`git status` showed hundreds of OTHER cards'
`trace.json` mid-flight-modified at the same time — multiple orchestrator
sessions are actively working this same pool right now, per this project's
own documented concurrent-agent convention). `vitest run functional-model`:
351/351. `find-synergies.mjs` diff, isolated to lines mentioning "Al Bhed
Salvagers" (grepped before/after, stripped line-number prefixes, diffed):
**zero interaction-line change** — the pre-migration `synergy.json` was
ALREADY functionally v2-shaped for its `lifeloss`/`lifegain`/`dies`-sink
facts (same fields, same matching behavior), so this migration only ADDED
annotations plus 3 new self-referential baseline facts (`cast`/
`entersBattlefield`/`dies` with `target:'self'`) that don't produce any new
cross-card matches (a `target:'self'` SINK elsewhere in the pool only ever
matches that SAME card's own producer, never this one).

**Real incident, worth flagging for future diff isolation**: used
`git stash push -- <2 files>` / `git stash pop` to get a clean before/after
`synergy.json`+`trace.json` pair for the `find-synergies.mjs` diff. Between
the push and the pop, a CONCURRENT peer session's own work landed on top of
this repo's shared working tree, and by the time I got back to re-checking
(several tool calls after the pop), `trace.json` had reverted to the
pre-migration flat-scenario content again (`synergy.json` stayed correct)
— re-running `run-scenarios.mjs --slug=al-bhed-salvagers` fixed it
immediately, so no real data was lost, but this confirms `git stash` is
NOT safe for before/after isolation in this actively-multi-agent repo (a
peer session's own unrelated `git` operation, or just their own writes
landing in the same window, can interact with a stashed/popped file in
ways a single-session workflow wouldn't). **Prefer the git-HEAD-swap-via-
plain-file-copy technique the `sahagin` entry above already used instead of
`git stash`** for any future isolated-diff work in this repo — copy the
current files aside, restore `git show HEAD:<path>` content, diff, then
restore the copies directly (no `git stash` index/ref involved at any
point, nothing for a concurrent session's own git operations to collide
with).

**Open Forge-verification still needed**: none — oracle text and existing
engine vocabulary (`loseLife`/`gainLife`/`dies`) were already established
and Forge-verified by earlier passes; this was a pure Fact-model migration
of an already-correct `definition.ts`, not new engine behavior.

## Black Mage's Rod (fin/90) — unified Fact model migration (2026-09-12)

Job-select-Equipment family, same batch as Thief's Knife/Dragoon's Lance/
White Mage's Staff. Used White Mage's Staff's own same-day progress.json
as the freshest house-style template (not Thief's Knife — checked git log,
Thief's Knife's `definition.ts`/`scenarios.ts` haven't been touched since
the original 2026-09-04 v1 batch commit despite already declaring an
executable `onEquippedDealsDamage` granted-trigger; its own `progress.json`/
`synergy.json` are stale and it hasn't landed the v2 Fact migration or
gap-14's continuousPTGrants/continuousTypeGrants yet — not a usable "fresh"
precedent).

- P/T grant (+1/+0) and type grant (Wizard) are now real via
  `continuousPTGrants`/`continuousTypeGrants` (gap #14, closed earlier
  today) — same `equippedBySelf` targeting shape as every sibling.
  Real facts authored, exempted via the existing SHAPE-scoped
  `isEquippedPTGrantFact`/`isEquippedTypeGrantFact` (no new exemption
  needed — this card's plain `harness.ts` scenario hits the same
  no-possible-evidence wall every sibling does).
- The granted "whenever you cast a noncreature spell, deals 1 damage to
  each opponent" triggered ability: re-checked ENGINE_GAPS.md fresh —
  still no pipeline anywhere grants a NEW triggered ability (condition +
  effect) to another permanent (closest is `grantKeywordTarget`/
  `grantKeywordAll`, keyword-only). Nothing changed since White Mage's
  Staff's own same-day closure of this exact question. Modeled as a real,
  deliberately inert `{event:'damage', controller:'you', recipient:'opp',
  targeted:false, value:1}` fact (reusing Summon: Bahamut's own
  `damage`/`recipient`/`targeted` vocabulary) — exempted via a new,
  card-NAME-scoped `isBlackMagesRodGrantedAbilityFact` (first
  `damage`-shaped instance of this gap class; `putCounter`/`lifegain`
  already have their own scoped exemptions on other cards — a new event
  shape restarts the shape-vs-name generalization question per
  `isEquipGrantedPutCounterFact`'s own doc comment).
- Collapsed `scenarios.ts` to 1 consolidated scenario (Job-select trigger
  + `sequence:[{activate:true}]` equip), same paladin-s-arms/white-mage-
  s-staff fix for this exact "trigger-only scenario skips the auto-activate
  path" shape.
- New `annotations-authoring.json` (7 entries) baked via
  `compute-annotations.mjs` — computed offsets matched my own independent
  hand-computation exactly before running the script. Added to
  `ANNOTATED_CARD_SLUGS`.
- Sink annotation note: this card's own "Equip {3}" line has NO reminder
  text (unlike Paladin's Arms/Machinist's Arsenal) — annotated the bare
  cost string directly, same convention Dragoon's Lance's own
  reminder-text-less "Gae Bolg — Equip {4}" line already established.

**Verification**: `verify-synergy.mjs` scoped -> 0 hard failures, 2 expected
soft notes (real `equip` trace lines, PARKED_ACTION_FNS, identical to White
Mage's Staff's own scoped output). Full pool: 319 v2 checked, 0 hard
failures caused by this pass (4 pre-existing hard failures — al-bhed-
salvagers, stuck-in-summoner-s-sanctum, valkyrie-aerial-unit — confirmed via
`git status` as concurrent peer-session in-flight migrations, unrelated).
`vitest run functional-model`: 351/351. `find-synergies.mjs` diff (isolated
git-HEAD swap of just this card's own synergy.json, restored after):
incoming (equip sink) byte-identical; outgoing 128 -> 174 lines (+46) — the
same "old bare battlefield-presence fact renamed+doubled via self-enters,
plus ~35 new type-constrained Artifact/Equipment-aware matches" mechanism
White Mage's Staff's own diff already documented; 0 pump/grantType/damage-
driven matches gained (no sink in the pool wants any of these 3 event
shapes yet).

**Open Forge-verification needed**: none — real oracle text confirmed
directly against `data/fin/fin_scryfall.json` (collector_number 90); this
was a fact-model migration onto already-closed engine mechanics

## Stuck in Summoner's Sanctum (fin/76) — migrated to current unified Fact model (2026-09-12)

Oracle (confirmed against `data/fin/fin_scryfall.json` collector_number 76):
Flash / Enchant artifact or creature / "When this Aura enters, tap
enchanted permanent." / "Enchanted permanent doesn't untap during its
controller's untap step and its activated abilities can't be activated."

**Precedent check (sleep-magic, fin/74, same batch, per the dispatch)**:
that card's own migration is STALE (last touched 2026-09-04, pre-dates the
`role`-less on-disk shape, `to`/`from`, required `annotations` — its
`synergy.json` still has bare `zone`/no `annotations` at all), so it wasn't
usable as a schema-shape template. Its one real, still-valid answer: the
"doesn't untap" clause got NO Fact at all, left as pure `staticAbilities`
text with an inline comment ("real continuous facts, not resolvable
effects — text only") — carried forward as-is for this card's identical
clause, EXTENDED to the additional "activated abilities can't be
activated" restriction this card alone has (see gap below).

**Facts authored** (synergy.json, annotations baked via
`compute-annotations.mjs` off a real `annotations-authoring.json`):
self-cast (Hand, typeLine-anchored "Enchantment"), self-enters
(Battlefield, typeLine-anchored, `controller:'you'`), and a real produce
`{event:'tap', target:{types:{hasAny:['Artifact','Creature']}},
targeted:true}` for the ETB trigger — no `controller` restriction (unlike
Ice Flan's own "target artifact or creature an OPPONENT controls," this
card's own "Enchant artifact or creature" has no controller clause at all,
confirmed against oracle text, same no-controller pattern Coeurl's own
unrestricted "target nonenchantment creature" tap fact already
established). Matching sink: `{to:'Battlefield',
types:{hasAny:['Artifact','Creature']}}`, no controller, same reasoning.
No Fact for Flash (timing-only, no board-state claim, same "bare printed
keyword" treatment as "can't be countered") — `keywords:['Flash']` was
already correctly declared pre-migration.

**Real, pre-existing bug found and fixed while migrating (not just a Fact
authoring change)**: the card's own `onEnter` trigger declared
`validType:'any'` with a comment claiming `tapTarget`'s own resolution pool
is "always creatures regardless of validType." Checked `card.ts` directly:
false — `case 'tapTarget'` passes `effect.validType` straight through to
`battlefieldPool`/`matchesValidType` with no creature-only default (unlike
`grantKeywordTarget`'s own explicit `?? 'creature'` fallback just above
it), and `'creature-or-artifact'` already exists as real
`BattlefieldValidType` vocabulary (present since the very first commit
introducing `card.ts`, not something newly added this pass). Fixed to
`validType:'creature-or-artifact'` — the textually-exact match for
"Enchant artifact or creature," narrower and more correct than `'any'`
(which would incorrectly also match lands/enchantments/etc.). Comment
corrected in place rather than left stale.

**Scenario fix, needed for the new baseline facts to have real trace
evidence**: the existing scenario used a bare `trigger:'onEnter'`, which
`harness.ts`'s own `lifecycleBefore` guard (`if (scenario.trigger || ...)
return []`) suppresses ALL cast/enters lifecycle logging for — switched to
`sequence:['onEnter']` (a single-string step is shorthand for `{trigger:
name}`, same face), which does NOT trip that guard, so the trace now shows
a real `cast -> enters -> trigger` sequence, matching ice-flan/coeurl's own
onEnter scenario shape. Still "default 1 scenario, real basic function" —
no new scenario added, the existing one just demonstrates more now.

**Real engine-gap finding, documented (ENGINE_GAPS.md gap #18, new,
OPEN)**: "activated abilities can't be activated" — checked
`engine.ts`'s `canActivateAbility` end-to-end, no hook anywhere checks
whether the TARGET permanent's own activation is locked by another
permanent's static ability (every check there is about the ACTIVATOR's own
state). Genuinely unsupported, not fabricated — left as honest
`staticAbilities` text, same treatment the "doesn't untap" half already
has (that half is the SAME known gap sleep-magic's identical clause has:
`state.ts`'s `untap()` only special-cases the real STUN counter
replacement, no general per-object lock).

**Verification**: `verify-synergy.mjs` scoped -> 0 hard failures, 0 soft
notes. Full pool: 319 v2 checked, 0 hard failures caused by this pass (2
pre-existing hard failures at the time — al-bhed-salvagers,
valkyrie-aerial-unit — confirmed via `git status` as concurrent
peer-session in-flight migrations, unrelated; this card itself is no
longer one of them). `vitest run functional-model`: 351/351.
`find-synergies.mjs` diff (isolated git-HEAD swap of just this card's own
synergy.json, restored after): 117 -> 156 lines touching this card, +39,
**zero lines lost** (pure gain — the old schema's bare, narrower
`{zone:'Battlefield', controller:'you', types:{has:['Creature']}}` sink
never existed as a real `entersBattlefield`-shaped produce/broader
artifact-or-creature sink at all, so this is new matching surface, not a
narrowed/regressed one).

**Real, incidental side effect worth flagging (2026-09-12, mid-task)**:
`run-scenarios.mjs` with a bare positional slug arg (no `--slug=` prefix)
silently regenerates the ENTIRE pool's `trace.json` files instead of
scoping — caused an accidental ~300-file regen (including several other
sessions' in-progress cards, e.g. summon-bahamut, mid-edit at the time).
Caught immediately and reverted via `git checkout HEAD --` on exactly the
files that were clean before the accidental run (cross-checked against the
initial `git status` snapshot so no OTHER session's legitimate uncommitted
work was touched) — always use `--slug=<name>`, never a bare positional
arg, for this script.

**Open Forge-verification needed**: none — real oracle text confirmed
directly against `data/fin/fin_scryfall.json` (collector_number 76); both
"doesn't untap" and "can't activate abilities" are checked against this
engine's OWN real source (`state.ts`/`engine.ts`), not Forge — no Forge
citation needed for an accepted-gap writeup, same treatment sleep-magic's
own gap already got.
(gap #14), not new engine work.

## Ultros, Obnoxious Octopus (fin/83) — migrated to unified Fact/annotations model (2026-09-12)

`{1}{U}` Legendary Creature — Octopus. Real oracle: "Whenever you cast a
noncreature spell, if at least four mana was spent to cast it, tap target
creature an opponent controls and put a stun counter on it. / Whenever you
cast a noncreature spell, if at least eight mana was spent to cast it, put
eight +1/+1 counters on Ultros."

**Mana-spent tracking, checked against the sibling card before writing
anything**: Sahagin (fin/71, same batch, identical real `ValidSA$
Spell.ManaSpent GE4` condition) already concludes in its own definition.ts
comment that this engine has no mana-spent tracking anywhere (no
Effect/EffectContext field carries how much mana a cast spent). Ultros's
own definition.ts already used the same convention before this task (two
named triggers, `onNoncreatureSpellCastGE4Mana`/`GE8Mana`, each standing in
for "the condition was met" once fired) — kept consistent, just
cross-referenced Sahagin explicitly in the comment rather than
re-deriving/re-litigating.

**Facts** (5 SOURCE + 1 SINK, all annotated): baseline `self-cast`
(`{event:'cast', from:'Hand', ...}`)/`self-enters`
(`{event:'entersBattlefield', to:'Battlefield', ...}`), typeLine-anchored on
"Creature" — replacing the old bare `{zone:'Battlefield', subject:'self'}`
presence fact (superseded — SOURCE facts must be movements, not presence)
AND a bogus `{zone:'Graveyard', subject:'self'}` fact that had NO real
textual basis at all (Ultros's own text never sends it to a graveyard) —
dropped outright, not carried forward, per the established "fold it or
drop it" rule for a fact with nothing real to anchor to. The GE4 trigger's
real effect (tap+stun) is 2 SOURCE facts reusing Ice Flan's own real fact
shape precedent (`{event:'tap', controller:'opp',
target:{types:{has:['Creature']}}, targeted:true}` +
`{event:'putCounter', counterType:'stun', ...}` — same shape, narrowed to
`has:['Creature']` only since this card's real text has no artifact
disjunction the way Ice Flan's does, and no engine-narrowing mismatch
either), paired with 1 SINK fact reusing Ice Flan's own target-availability
sink (`{to:'Battlefield', controller:'opp', types:{has:['Creature']}}`).
The GE8 trigger's real effect is 1 SOURCE-only fact
(`{event:'putCounter', counterType:'+1/+1', target:'self'}`, amount 8 baked
into the trace/weight, no `targeted` — self-only, no external want, no sink
needed). This satisfies the task's "2 separate sink/source fact pairs" ask:
one trigger gets a source-pair + sink, the other gets a source only,
because only one of the two real effects has anything external to want.

**Real engine bug found and fixed, not just fact authoring**: the GE4
trigger's effect used to be a hand-rolled `kind:'custom'` workaround
(predating `tapTarget`/`putCounterTarget`'s own `owner` field) that called
`actions.putCounter(target, 'Stun', 1)` — capital `'Stun'`, inconsistent
with the pool-wide lowercase `'stun'` convention every other real stun-
counter card uses (Ice Flan, Tonberry, Summon Shiva, Aerith Rescue
Mission all lowercase; only this card and Omega, Heartless Evolution used
capital). Replaced with 2 declarative effects (`tapTarget`+
`putCounterTarget`, both `validType:'creature', owner:'opponents'`) —
Ice Flan's own definition.ts comment already explicitly calls THIS card
out by name as one of the "now-obsolete `custom` workarounds used before
`owner` existed on these kinds," so this wasn't a novel design call, just
following through on an already-flagged TODO. This also silently fixed the
counterType casing mismatch (first `verify-synergy.mjs` pass caught it as
a real hard failure: fact said `'stun'`, trace said `'Stun'`).

**Scenarios**: consolidated 3 -> 2 (plus keywordScenarios' own auto-added
legend-rule scenario, since this is Legendary). The old 2 separate
`trigger:`-scoped scenarios (GE4-with-target, GE8) are now ONE scenario
with no top-level `trigger` + `sequence:
['onNoncreatureSpellCastGE4Mana', 'onNoncreatureSpellCastGE8Mana']` — a
single real noncreature spell spending 8+ mana also spent 4+, so casting
ONE big spell genuinely fires both triggers at once (the task's own
"check if 1 scenario can show both by casting one big enough spell" idea,
confirmed to work). This ALSO fixed a real evidence gap: a `trigger:`-
scoped scenario starts self already on the battlefield (harness.ts's own
`selfZone` rule), so the new baseline self-cast/self-enters facts would
have had zero real trace evidence under the old scenario shape; dropping
the top-level `trigger` for `sequence` instead runs the real cast->enters
lifecycle first (same ice-flan/dwarven-castle-guard/cloudbound-moogle
consolidation precedent already established). The "no legal target" edge
case (a real branch in the tapTarget/putCounterTarget pool-emptiness path,
distinct from the non-branching mana thresholds) stays its own scenario.

**Verification**: `verify-synergy.mjs ultros-obnoxious-octopus` -> 0 hard
failures (1 soft note: `legendRule` trace line with no matching declared
produce — expected/structural for every Legendary creature run through
keywordScenarios' own `duplicateLegendaryEnters` scenario, not a gap).
Full pool (319 checked): 3 pre-existing hard failures
(al-bhed-salvagers, stuck-in-summoner-s-sanctum, valkyrie-aerial-unit), all
unrelated — confirmed concurrent peer-session in-flight work (`git status`
showed sahagin's own definition.ts/scenarios.ts/synergy.json/trace.json/
annotations-authoring.json all mid-edit by another session during this
same task — the exact sibling card this task said to cross-check against).
`vitest run functional-model`: 351/351. **Real mid-task incident**: this
card's own `trace.json` was transiently clobbered back to its pre-task
(3-scenario, capital-`'Stun'`) content by that same concurrent activity
partway through — caught immediately by re-running
`verify-synergy.mjs`/grepping `counterType` right after regenerating it,
fixed by re-running `run-scenarios.mjs --slug=ultros-obnoxious-octopus`
a second time and re-verifying before moving on, per al-bhed-salvagers's
own already-documented "prefer plain-file-copy + git-show-HEAD isolation,
not `git stash`, in this actively-multi-agent repo" lesson (reused here,
not rediscovered).

`find-synergies.mjs` diff (isolated via `git show HEAD:<path>` swapped
into `synergy.json` temporarily, not `git stash`): before 163 lines (142
"battlefield presence" + 21 "graveyard presence", both from the old
bare-presence facts), after 142 ("enters the battlefield" only). Net -21,
fully accounted: the 142 are the SAME cards, just correctly relabeled from
presence to a real movement fact (no regression); the 21 lost are the
deliberate removal of the bogus self-graveyard fact (no real textual
basis). Zero new matches yet from the newly-authored tap/putCounter(stun)/
putCounter(+1/+1 x8)/opponent-creature-sink facts — expected, no other
pool card currently sources/wants those specific events yet (same
"new, forward-looking vocabulary, 0 matches today" pattern already
established for other event-vocabulary promotions).

**Open Forge-verification still needed**: none — oracle text confirmed
directly against `data/fin/fin_scryfall.json` (fin/83); the mana-spent
tracking gap itself was already established/Forge-verified by Sahagin's
own earlier pass (`ValidSA$ Spell.ManaSpent GE4` citation), not
re-derived here.

## Travel the Overworld (fin/82) — migrated to unified Fact model, closes ENGINE_GAPS.md gap #7's cast-side board-counted remainder (2026-09-12)

Oracle (`data/fin/fin_scryfall.json` #82): "Affinity for Towns (This spell
costs {1} less to cast for each Town you control.) / Draw four cards."
Sorcery, {5}{U}{U}. Real Forge citation: `res/cardsfolder/t/
travel_the_overworld.txt` declares `K:Affinity:Town` — checked against
`tmp/mtg-forge`'s own source (not guessed): `forge-game/.../keyword/
Keyword.java` line 12 (`AFFINITY`) + `CardFactoryUtil.java`'s
`addStaticAbility` (~lines 3749-3766) expands it into `Mode$ ReduceCost |
ValidCard$ Card.Self | Type$ Spell | Amount$ AffinityX | EffectZone$ All`
paired with a dynamically-built `SVar:AffinityX:Count$Valid Town.YouCtrl` —
mechanically the exact same real board-counted mechanism qiqirn-merchant's
own `ActivationCostReduction` already models on the ACTIVATION side, just
applied here to a spell's own CAST cost.

**Real gap check confirmed before building anything** (per this task's own
explicit instruction): `card.ts`'s `CostReduction` (the CAST-side hook) only
supported a fixed `amount`/target-`condition` pair (fate-of-the-sun-cryst's
shape) — no board-counted case existed on the cast side; `SpellCostReductionGrant`
(the broadcast hook, the-wind-crystal) only supports a flat, color-gated
amount. `ActivationCostReduction` (the activation-side hook, qiqirn-merchant)
already supports board-counting but only for `card.abilities[].costReduction`,
never a spell's own `manaCost`. This WAS the real, narrower remaining gap the
cost-reduction work had flagged — closed it rather than declaring it
un-closeable, since the fix was small and reused an existing shape.

**Engine change (small, scoped, same shape as the existing hook, per the
task's own instruction)**: `card.ts`'s `CostReduction` gained a new
`perControlled?: {amountPerMatch: number; subtype: string}` field (the exact
same shape as `ActivationCostReduction`) — `amount`/`condition` are now both
optional instead of required, since `perControlled` is mutually exclusive
with them (a card picks one shape or the other; no real FIN card needs both).
`engine.ts`'s `effectiveCastCost` gained a `perControlled` branch: when set
and `caster` is supplied, counts `caster.battlefield.filter(c =>
c.subtypes.includes(subtype)).length * amountPerMatch` and folds it into the
existing summed-discount total (still applied via the pre-existing
`reduceGenericCost`) — the exact same counting expression
`effectiveActivationCost` already uses for `ActivationCostReduction`, just
reading `caster.battlefield` (the CASTER, i.e. `pilot.you`/whoever is
casting) instead of `controller.battlefield` (the ACTIVATOR). No new params
needed on `canCastSpell`/`castSpell`/`pilotCast` — they already thread
`caster`/`pilot.you` through to `effectiveCastCost` for the existing
broadcast (`SpellCostReductionGrant`) case, so `perControlled` rides the same
plumbing for free.

`cards/travel-the-overworld/definition.ts` now declares `costReduction:
{perControlled: {amountPerMatch: 1, subtype: 'Town'}}`, replacing the old
documentary-only `staticAbilities` string (same "structured field replaces
free text once real" convention every other cost-reduction migration already
established).

**Facts** (unified model, no `id`, real `annotations`, required min 1):
- `{event:'cast', from:'Hand', target:'self',
  costReductionPerControlled:{amountPerMatch:1, subtype:'Town'}, value:1}` —
  the cast fact itself is the real cost-payment act (CR 601.2f), so
  `costReductionPerControlled` (the SAME purely-documentary field
  qiqirn-merchant's own `sacrifice` fact already carries — its own doc
  comment in synergy.ts already explicitly covers BOTH 601.2f and 602.1, so
  this is the field's designed-for use, not a stretch) attaches directly to
  it. Annotated to oracle line 0 (the full "Affinity for Towns..." clause) —
  a deliberate departure from the usual bare-typeLine anchor a plain cast
  fact gets (memories-returning/fate-of-the-sun-cryst's own baseline
  `cast`+typeLine convention) since THIS cast fact carries real, specific
  discount data that the typeLine says nothing about; anchoring to the text
  that actually backs the new claim is more honest than defaulting to
  boilerplate.
- `{to:'Graveyard', controller:'you', subject:'self', value:1}` — baseline
  self-graveyard, typeLine-anchored, same shape every migrated Sorcery/
  Instant in the pool already uses.
- `{event:'drawCard', controller:'you', value:1}` — real drawCard(4) fact.
  `value:1` (not 4) is CORRECT per current tooling, not a bug: compute-
  weights.mjs's `sourceMagnitude` has no `event === 'drawCard'` branch at
  all, so EVERY drawCard fact pool-wide gets the neutral floor regardless of
  amount (confirmed against qiqirn-merchant's own 3-card `bigDraw` drawCard
  fact, which shows the same `value:1`) — a real, pre-existing, pool-wide
  compute-weights.mjs gap, not something to fix as part of this migration.

**Scenario** (1, engine-piloted, replacing the old flat harness.ts shape):
casts with 2 real Town lands on board (Capital City, Gongaga, Reactor Town —
same real pair qiqirn-merchant's own scenario already uses for the identical
discount shape), provisions the FULL undiscounted `{5}{U}{U}` worth of real
Islands (same fate-of-the-sun-cryst "prove the discount reduced what was
owed, not that less mana merely happened to be available" technique) —
trace confirms the logged `cast` cost genuinely reads `{3}{U}{U}` and only 5
`tapForMana` lines appear, not 7. Then resolves: 4 real `drawCard` lines.

**Verification**: `verify-synergy.mjs travel-the-overworld` -> 0 hard
failures (a few soft notes: `enters`/`tapForMana` unrecognized action
notes, same "not a gap" pattern every other Town-land-bearing scenario in
the pool already has). Full pool (320 checked): 2 pre-existing hard failures
(sleep-magic, valkyrie-aerial-unit) — confirmed unrelated, concurrent
peer-session in-flight work (this is an actively multi-agent repo right
now — `ANNOTATED_CARD_SLUGS` in `scripts/annotation-coverage.mjs` visibly
grew mid-task from other sessions' own concurrent edits, same as other
agents' own documented experience this same day). `vitest run
functional-model`: 351/351 (only pre-existing y-shtola-rhul annotation
gap seen mid-task, from a concurrent session's own in-flight card,
resolved by the time of the final run). `find-synergies.mjs` diff (isolated
to lines mentioning "Travel the Overworld" specifically, since the whole-
pool diff is too noisy to isolate one card's change amid this many
concurrent migrations): before 13 "graveyard presence" lines, after 13
"moves to graveyard" lines — same 13 real cards, net-zero match-count
change, only the label changed (legacy bare `zone:'Graveyard'` -> real
`to:'Graveyard'` movement fact, same rename every other migrated card's own
self-graveyard fact already goes through). No new matches from the cast/
drawCard facts — expected, `costReductionPerControlled` is purely
documentary (never consulted by `factsInteract`) and no sink in the pool
wants a bare `event:'drawCard'` today.

**Real mid-task incident, same known class already documented elsewhere in
this file (ultros-obnoxious-octopus's own writeup, same day)**: this card's
own freshly-regenerated `trace.json` was transiently reverted back to its
pre-task (old flat harness.ts, empty-setup) content by concurrent activity
partway through — caught by `git status`/`git diff` unexpectedly showing no
change right after a successful regen, fixed by re-running `run-scenarios.mjs
--slug=travel-the-overworld` a second time and immediately re-verifying
(`verify-synergy.mjs`, `git status`) before moving on, rather than trusting
the first regen. `scenarios.ts`/`definition.ts` themselves were never
observed reverted, only the generated `trace.json` — consistent with a
peer session's own unrelated `run-scenarios.mjs` invocation (scoped or not)
racing with this task's own write, not a content conflict.

**One tooling gotcha re-confirmed** (already known, not new): `scripts/
compute-weights.mjs` resolves its own `cardsDir`/`cardsDirPath` off
`process.cwd()`, NOT `import.meta.url` — running it with cwd=`functional-
model/` silently reports `pool: 0 cards` (no error) instead of the intended
card; must be run from the repo ROOT (`npx vite-node functional-model/
scripts/compute-weights.mjs --slug=<slug>`). `compute-annotations.mjs`/
`verify-synergy.mjs`/`find-synergies.mjs`/`run-scenarios.mjs` are all
`import.meta.url`-relative and cwd-independent, so this is specific to
`compute-weights.mjs` alone — worth double-checking output looks sane
(`pool: 1 cards`, not `0`) whenever invoking it scoped.

**Open Forge-verification still needed**: none — oracle text confirmed
directly against `data/fin/fin_scryfall.json` (fin/82); the Forge-side
`K:Affinity:Town` expansion mechanism was checked directly against
`tmp/mtg-forge`'s own real source (`Keyword.java`/`CardFactoryUtil.java`),
not assumed from the card-script text alone.

## Y'shtola Rhul (fin/86) migrated to unified Fact model (2026-09-12)

"At the beginning of your end step, exile target creature you control, then
return it to the battlefield under its owner's control. Then if it's the
first end step of the turn, there is an additional end step after this
step." 4 SOURCE facts (baseline `self-cast`/`self-enters`, typeLine-anchored
to "Creature" — same span zack-fair/the-lunar-whale use for a plain
"Legendary Creature" type line, no second stacked type to distinguish
cast-vs-enters the way summon-choco-mog's "Enchantment Creature" does — plus
a real targeted exile-then-return pair, `{to:'Exile',from:'Battlefield',
controller:'you',target:{types:{has:['Creature']}},targeted:true}` /
`{to:'Battlefield',from:'Exile',event:'entersBattlefield',controller:'you',
target:{types:{has:['Creature']}},targeted:true}` — same `to`/`from` pair
shape jill-shiva-s-dominant/dion-bahamut-s-dominant's own self-transform
exile+return already use, but `target`-constrained rather than
`subject:'self'` since this blinks a CHOSEN creature, not necessarily
itself; checked, no prior pool precedent for blinking a target OTHER than
self). 1 SINK fact for "target creature you control". Full details/diff
numbers in `SYNERGY_DESIGN.md`'s own new bullet (end of "Implementation
notes (this pass)") and `cards/y-shtola-rhul/progress.json`'s `notes` — not
re-duplicated here.

**The "additional end step" clause deliberately got NO Fact at all** (not
even an unmatchable one) — no Effect kind/event vocabulary represents
"insert another phase" in any form, a stricter case than Auron's
Inspiration's "real vocabulary exists, trace evidence doesn't" exemption.
Surfaced a genuine new engine gap, added as `ENGINE_GAPS.md` #17 (checked
`ENGINE_GAPS.md` for an existing entry first, and `grep '^[0-9]\+\.'` for a
numbering collision, per the task's own explicit warning that one happened
earlier the same day — #17 was clean). Checked `turn.ts` directly before
writing it up: `TurnState.extraTurns` (gap #3, closed) only queues a WHOLE
EXTRA TURN at the turn-wrap point; nothing splices one more occurrence of
the CURRENT phase into the CURRENT turn's fixed `PHASES` walk — genuinely
different from extra turns, not a duplicate framing of a closed gap.

**Important correction caught by grepping the real Forge cardsfolder pool-
wide before finalizing the gap writeup as narrow**: this `DB$ AddPhase`
primitive gap is NOT unique to Y'shtola. Balthier and Fran and Genji Glove
(both already migrated into this pool) independently hit the identical gap
for their own "additional combat phase" clauses and each left only a
per-card comment ("no turn/phase-structure Effect shape exists here") with
no central `ENGINE_GAPS.md` tracking until now. Gap #17 is written to cover
BOTH real shapes (extra end step; extra combat phase) as one underlying
missing primitive (Forge's own single `DB$ AddPhase` covers both via its
`ExtraPhase$` param), not two separately-tracked near-duplicates. Lesson for
future gap writeups: always grep the real cardsfolder pool-wide for the
same Forge mechanism before describing a newly-found gap as narrow to one
card — a per-card comment elsewhere in the pool can already be sitting on
the identical undocumented gap.

**Verification**: `verify-synergy.mjs y-shtola-rhul` (scoped) — 0 hard
failures, 1 soft note (`legendRule` with no matching declared produce),
confirmed via a live cross-check (the-prima-vista/ultros-obnoxious-octopus)
to be the same pool-wide-accepted `keywordScenarios()` "second-copy-
legendary" probe every other annotated Legendary card using that helper
also produces — not something this migration introduced, no action needed.
Full pool: 319 checked, 4 pre-existing hard failures unrelated to this card
(al-bhed-salvagers, stuck-in-summoner-s-sanctum, ultros-obnoxious-octopus,
valkyrie-aerial-unit — all mid-edit by concurrent sessions per `git
status`, same "heavily multi-agent repo today" pattern noted elsewhere in
this file). `npx vitest run functional-model`: 351/351, both before and
after every edit in this task. `compute-annotations.mjs y-shtola-rhul` /
`compute-weights.mjs --slug=y-shtola-rhul --` (run from repo root, per this
file's own already-documented `compute-weights.mjs` cwd gotcha) both ran
clean; annotation offsets I hand-authored in `annotations-authoring.json`
came back byte-identical to what `compute-annotations.mjs` computed
independently from real oracle text, a good sign the offsets were right
before the tool ever ran. Added `y-shtola-rhul` to `ANNOTATED_CARD_SLUGS`
(`scripts/annotation-coverage.mjs`) — that file had already grown from
concurrent sessions' own edits between my read and my write, same pattern
this file documents elsewhere; re-read before editing, appended after the
current last entry rather than reverting anyone else's addition.

**Open Forge-verification still needed**: none for this card itself (oracle
text/mana cost/type line/P&T all confirmed directly against
`data/fin/fin_scryfall.json` #86, byte-identical to `definition.ts`; the new
gap's own Forge citations — `yshtola_rhul.txt`'s `DB$ AddPhase`/
`Count$FinishedEndOfTurnsThisTurn`, `ultimecia_time_sorceress_...txt`'s `DB$
AddTurn`, `balthier_and_fran.txt`/`genji_glove.txt`/`tifa_martial_artist.txt`'s
own `AddPhase` lines — were all read directly from `tmp/mtg-forge`, not
guessed). Genuinely open, for a FUTURE task: `tifa_martial_artist` (the
third real "additional combat phase" FIN card found while writing up gap
#17) is not yet migrated into `cards/` at all — worth migrating alongside
any future attempt to actually close gap #17, so all 3 real "extra phase"
cards land together.

---

## summon-leviathan (fin/77) migrated to unified Fact model (2026-09-12)

Real Saga (Enchantment Creature — Saga Leviathan, {4}{U}{U}, 6/6, Ward {2}),
non-transforming. `definition.ts` already modeled chapterI/II/III as named
triggers pre-migration (this pool's own `saga.ts` convention); this pass
touched synergy.json/scenarios.ts/annotations-authoring.json/progress.json,
plus small doc-comment additions to definition.ts (Ward's own status,
chapterII/III cross-ref). Real Saga automation reused `saga.ts`'s
`advanceSaga`/`advanceSagasAfterDrawStep` directly — no new engine code
needed, confirmed via a real `engine-trace.ts` single-scenario pilot
(replacing the old flat `harness.ts` Scenario[] with 2 chapterI cases + 2
"no resolvable effect" chapterII/III placeholders). Full authoring
reasoning, fact list, and the real find-synergies.mjs diff numbers are all
in `cards/summon-leviathan/progress.json`'s own notes (not duplicated
here) — short version below.

**Real, checked-against-Forge findings** (`tmp/mtg-forge/forge-gui/res/
cardsfolder/s/summon_leviathan.txt`):
- Chapter I ("Return each creature that isn't a Kraken/Leviathan/Merfolk/
  Octopus/Serpent...") is `DB$ ChangeZoneAll`, no owner restriction — a
  real, forced, unconditional, symmetric mass bounce (both players'
  non-tribal creatures return), not a targeted effect at all. No
  `preferTarget`/`declineOptional` needed in the scenario, unlike
  Bahamut's own optional `destroy`.
- Chapters II/III ("...whenever a [tribal type] attacks, draw a card") are
  `Defined$ You` — the draw ALWAYS goes to Summon: Leviathan's own
  controller, regardless of whose creature attacks. This clause GRANTS A
  WHOLE NEW TRIGGERED ABILITY to a TYPE-matched bucket of creatures across
  the WHOLE battlefield (either player's) — same "no vocabulary anywhere
  in this model grants a fresh triggered ability to another permanent" gap
  class `white-mage-s-staff`'s own migration documents, but the pool's
  FIRST non-equipment instance (every prior instance —
  white-mage-s-staff, the astrologian's-planisphere-generalized
  `isEquipGrantedPutCounterFact`, black-mage-s-rod — is an Equipment
  granting to whatever's equipped; this is a Saga chapter broadcasting by
  type, not equip-scoped). Correctly stays a no-op `custom` effect in
  `definition.ts` (genuinely unexecutable, not a mismodel) — modeled as
  two real, honest, deliberately inert `{event:'drawCard', controller:
  'you', target:{types:{hasAny:[5 tribal subtypes]}}}` facts (one per real
  chapter firing, same "repeat per real occurrence" convention Jill's/
  Dion's own duplicated chapter facts establish), exempted via a NEW
  by-name-scoped `isSummonLeviathanGrantedDrawFact` in verify-synergy.mjs
  (not generalized by shape yet — first instance of this specific
  broadcast-by-type sub-shape, same escalation discipline
  `isEquipGrantedPutCounterFact`'s own doc comment establishes: a SECOND
  real card hitting this exact non-equip shape is what would justify
  generalizing).
- Ward {2}: confirmed via a full grep of `card.ts`/`engine.ts`/`synergy.ts`
  that Ward has ZERO engine enforcement anywhere — no targeting-legality
  chokepoint reads Ward, Hexproof, OR Protection at all (`resolveTargets`'s
  real 608.2b re-validation never reads a candidate's keywords). Same
  "declared, not enforced" status Hexproof/Protection already silently
  have pool-wide — NOT a gap this card's migration introduces, and not
  something ENGINE_GAPS.md's own "does a real FIN card need this" test
  currently flags (no FIN card's own scenario depends on any of the three
  actually gating a target). No Fact authored for Ward either — matches
  Diamond Weapon's own printed 'Reach' precedent (a plain printed keyword
  has no produce/want shape in this model's vocabulary at all).

**Verification**: `verify-synergy.mjs` scoped (0 hard failures) and full
pool (319 v2 checked, 3 PRE-EXISTING hard failures unrelated to this card
— sidequest-card-collection-magicked-card/sleep-magic/
valkyrie-aerial-unit, confirmed already-failing before this pass, other
agents' concurrent in-flight work, not caused by or touched by this one).
`vitest run functional-model`: 351/351. `tsc --noEmit`: zero new errors in
any file this pass touched. Real isolated find-synergies.mjs before/after
diff (swap in HEAD's synergy.json, re-run, restore, re-run — not a stale
diff): 120 -> 40 total match lines (118 lost, 38 gained, 2 unchanged) —
same expected "old unconstrained bare-zone fact matched broadly; new
precise self-cast/self-enters/dies/bounce facts match more narrowly but
correctly, plus real new type-constrained matches" tradeoff every other
real Saga/creature v2 migration in this pool already documents (see
progress.json for the full accounting — all 38 gains spot-checked
plausible against their own real oracle text, e.g. real "wants a creature
dying" sinks newly satisfied by the chapter III sacrifice's own dies
consequence, real "wants something bounced to hand" sinks newly satisfied
by the chapter I mass-bounce fact).

**Real, non-obvious finding while doing this task**: Jecht, Reluctant
Guardian // Braska's Final Aeon is NOT actually migrated to the v2 Fact
model yet, despite being one of the 3 real transforming-Saga cards
`saga.ts`'s own header cites as already-migrated precedent for chapter-
trigger NAMING — its own `synergy.json` is still old id/sourceText-shape
and its own `scenarios.ts` is still flat `harness.ts` style (`trigger:
'chapterI'` directly, no real turn passage at all). Only Jill and Dion are
actually migrated among that trio. Didn't touch Jecht (out of this task's
scope), but worth flagging for whoever picks it up next — it's a real,
not-yet-done migration, not a settled reference the way this task's own
instructions implied.

**Open Forge-verification still needed**: none for this card — oracle text
confirmed against both `data/fin/fin_scryfall.json` (#77) and the real
`tmp/mtg-forge` cardsfolder script directly. If Jecht's own migration is
picked up later, its real Forge script should be checked fresh the same
way (not assumed identical to Jill/Dion just because they share the same
"transforming into a Saga" shape).

## Syncopate (fin/80) — new card, {X}{U} Instant, "Counter target spell unless its controller pays {X}. If that spell is countered this way, exile it instead of putting it into its owner's graveyard." (2026-09-12)

Authored fresh (definition.ts/scenarios.ts/synergy.json/annotations-
authoring.json/trace.json/progress.json), same structural template as
Ether (fin/53) earlier the same day. Added to
`scripts/annotation-coverage.mjs`'s `ANNOTATED_CARD_SLUGS`.

**`kind:'counter'` reused as-is (card.ts/interfaces.ts), same log-only
primitive Louisoix's Sacrifice already established** — no stack/object
model anywhere in this engine lets a resolving spell remove a DIFFERENT
object from the stack, so there's no real target reference for `Effect`'s
`counter` variant to carry at all; `describe` is free text. Fact:
`{event:'counter', target:{}, targeted:true}` — fully unconstrained (this
card's own "target spell" has no type restriction, unlike Louisoix's own
"noncreature spell").

**Two real things checked and NOT modeled, both just documentary text
inside `describe`, neither a new Fact field**:
1. "unless its controller pays {X}" — a choice belonging to the COUNTERED
   SPELL's controller (an opponent), made mid-resolution — NOT the
   caster's own choice (contrast Louisoix's own "sacrifice OR pay {2}", a
   real `ctx.mode` choice the CASTER makes at cast time — structurally
   different, already-solved shape, not a precedent for this). No
   player-decision process exists anywhere in this engine for an
   OPPONENT's own mid-resolution choice (ENGINE_GAPS.md's own accepted
   "no AI/player decision process" simplification) — `actions.counter(...)`
   fires unconditionally regardless, same ceiling every `kind:'counter'`
   card already has.
2. "exile it instead of ... graveyard" — checked whether the CURRENT
   (2026-09-11 "Fact unification") schema, where `to`/`from` now freely
   co-occur with `event` on one Fact (no longer the old purely-documentary
   `zoneFrom`/`zoneTo` shape), could represent this as real matchable zone
   data. Rejected: the exiled object is a FOREIGN spell of unspecified
   type/controller, so there's no honest `subject`/`controller` to assert.
   Checked the pool: exactly ONE real zone-shaped sink wants Exile
   (the-darkness-crystal: `{zone:'Exile', controller:'you',
   types:{has:['Creature']}}`) — a type/controller-constrained want this
   fact can't honestly verify, so adding `to:'Exile'` would risk a real
   false-positive match, not a genuine one. Left as descriptive text only.

**fin/79 (Swallowed by Leviathan) does NOT exist in this repo yet** —
checked `cards/` directory and grepped the whole pool for "Leviathan":
no card folder, despite the slug already being pre-registered in
`ANNOTATED_CARD_SLUGS` as a placeholder. The task brief pointed at it as a
sibling card with a documented conclusion on the same "unless controller
pays" gap to stay consistent with — couldn't check it, so this card's own
conclusion (above) was reached independently. Flagged in progress.json's
`knownGaps` for whoever authors fin/79 to cross-check.

**Spell-cast `{X}` verified REAL for a genuine `{X}{U}`-costed Instant, not
just the generic synthetic fixture** (ENGINE_GAPS.md gap #6's own
`engine.test.ts` describe block only demonstrates a synthetic `{X}{R}{R}`
Sorcery) — this card's own real engine-piloted scenario casts with a
genuine caster-chosen X=2, and `trace.json` confirms the resolved cost:
`{fn:'cast', card:'Syncopate', cost:'{2}{U}'}` followed by exactly 3 real
`tapForMana` lines (2 generic + 1 blue), not the printed template
`{X}{U}`. Confirms `canCastSpell`/`castSpell`'s `x` param genuinely works
on a real spell's own CAST cost (as opposed to an activated ability's
cost, which was a separate closure) — checked, not assumed.

**Scenario technique, new precedent**: no existing `engine-trace.ts` pilot
helper casts as the OPPONENT (`pilotCast` always casts as `pilot.you`) —
this scenario needed a real opposing spell (Fire Magic, {R} Instant, a
real FIN card, not an invented placeholder) genuinely on the stack as
Syncopate's own target. Built by calling the low-level `canCastSpell`/
`castSpell` (from `../../engine`) directly with `pilot.opponents[0]` as
caster, and a manually-built `EffectContext` (`you`/`opponents` swapped
relative to `pilot.ctxFor`'s own fixed orientation, via `harness.ts`'s
exported `loggingCard`/`loggingPlayer`) — that ctx/actions pair is never
actually read, since this scenario never resolves Fire Magic (Syncopate,
cast in response, resolves FIRST — real LIFO stack order, and the
scenario stops there, same "the countered spell just sits there,
uninvolved" honesty the rest of the card's own documented gaps already
have). Worth reusing if a future card needs the same "real opposing spell
on the stack" setup — no dedicated pilot helper exists for it yet.

**Verification**: `verify-synergy.mjs syncopate` -> 0 hard failures (4 soft
`tapForMana`-unrecognized notes, same known/accepted gap every
engine-piloted real-mana-payment scenario already has). Full pool (320
checked, 3 skipped): 7 pre-existing hard failures at time of this run
(ardyn-the-usurper, black-mage-s-rod, scorpion-sentinel, sleep-magic,
stolen-uniform, the-water-crystal, valkyrie-aerial-unit) — confirmed NOT
caused by this task (syncopate itself isn't among them); re-checking
mid-task showed `scripts/annotation-coverage.mjs`'s own
`ANNOTATED_CARD_SLUGS` visibly growing from a concurrent session's own
edits between my read and this run (same actively-multi-agent-repo
situation other same-day entries in this file already document). `npx
vitest run functional-model`: 351/351 passed. `find-synergies.mjs`: brand
new card, no prior HEAD version to diff against — 13 real interaction
lines, all via the self-graveyard baseline fact ("moves to graveyard",
matching every other real unconstrained-instant/sorcery-in-graveyard
sink in the pool). Zero matches yet for `event:'cast'`/`event:'counter'`
(expected, forward-looking vocabulary, no sink wants either yet).
`tsc --noEmit`: 48 pre-existing baseline errors, unchanged by this card's
own files (none of the new errors mention `syncopate`).

**Tooling gotcha, already documented elsewhere in this file, re-hit**:
`scripts/compute-weights.mjs` resolves `cardsDir` off `process.cwd()`, not
`import.meta.url` — running it from inside `functional-model/` silently
reports `pool: 0 cards`; must run from the repo root
(`npx vite-node functional-model/scripts/compute-weights.mjs --slug=<slug>`).

**Open Forge-verification still needed**: none for this card's own real
mechanics — oracle text confirmed directly against
`data/fin/fin_scryfall.json` (fin/80); the `kind:'counter'` primitive
itself and the "no player-decision process" limitation were both already
Forge-checked when Louisoix's Sacrifice/the engine's own accepted
simplifications were originally written up, not re-derived here. The one
real open item is non-Forge: cross-check this card's "unless controller
pays" conclusion against fin/79 (Swallowed by Leviathan) once that card
actually gets authored (see above).

## 2026-09-12 (later still) — The Water Crystal (fin/85) migrated to unified Fact model, ENGINE_GAPS.md gap #19 opened (no `mill` mechanism)

Sibling migration to The Wind Crystal (fin/43, same day, same 3-clause
shape). Read `SYNERGY_DESIGN.md` fresh + `the-wind-crystal`'s own
`definition.ts`/`synergy.json`/`progress.json` as the house-style
precedent, per the task's own instruction.

**Clause 1 ("Blue spells you cast cost {1} less to cast")** — real,
`spellCostReductionGrants: [{ amount: 1, colors: ['U'] }]` (`card.ts`'s
`SpellCostReductionGrant`, ENGINE_GAPS.md gap #7's own second example,
identical mechanism The Wind Crystal's White discount already uses). Real
Forge citation checked directly, `tmp/mtg-forge/.../t/the_water_crystal.txt`:
`S:Mode$ ReduceCost | ValidCard$ Card.Blue | Type$ Spell | Activator$ You |
Amount$ 1 | ...`. `event:'costReduction'` fact authored — needs the exact
same per-card-name exemption in `verify-synergy.mjs` The Wind Crystal
already has (this card's own scenario never casts a SECOND spell for the
discount to differ against) — added `if (card.name === 'The Water
Crystal' && p.event === 'costReduction') continue;` right after the Wind
Crystal line.

**Clause 2 ("If an opponent would mill one or more cards, they mill that
many cards plus four instead")** — checked directly, confirmed genuinely
unsupported: NOT closeable the way gap #8b's lifegain-doubling was,
because that closure worked by hooking a chokepoint (`state.gainLife`)
that ALREADY EXISTED before the replacement was added. This engine has NO
`state.mill()` method anywhere — `interfaces.ts`'s own `mill(player, qty)`
is a pure ambient Forge-signature mirror, never given a real body (same
undone-mirror status as `scry`/`surveil` — checked, neither has a
`state.ts` body either). Every real mill in the pool (this card's own
activated ability, its only user — checked Ice Flan's Islandcycling and
Ultros per the task's own hint: neither mills, confirmed) is modeled ad
hoc via the generic `move` Effect kind, the same primitive every OTHER
zone-change effect shares — no way to intercept "this move is specifically
a mill" without first building a dedicated mill chokepoint. Opened
**ENGINE_GAPS.md gap #19** (NOT #17 — re-grepped `^[0-9]\+\.` fresh right
before writing and found #17/#18 already taken same-day by other
concurrent sessions, Y'shtola Rhul's phase-repeat gap and Stuck in
Summoner's Sanctum's ability-lock gap; the task's own suggested "#17" was
stale by the time I got to it — this is exactly the kind of collision the
task warned about, caught by re-checking rather than trusting the
number handed down). Left as real, honest `staticAbilities` text, no
Fact authored for it (nothing to anchor a produce fact to without
inventing a mechanism that doesn't exist) — did NOT build the mechanism
myself, per the task's own explicit scope (fact-authoring task, not new
engine mechanism).

**Clause 3 (activated ability, "{4}{U}{U}, {T}: Each opponent mills cards
equal to the number of cards in your hand")** — the BASE (undoubled)
amount is mechanically real, unchanged from the pre-migration file:
modeled via `kind:'move'` (library -> graveyard, unchosen batch,
`qty: ctx.you.getCardsIn('Hand').length`). Authored a real
`event:'mill', from:'Library', to:'Graveyard', controller:'opp'` SOURCE
fact — genuine trace evidence (`fn:'move', player:'opp0', to:'Graveyard'`)
needs no exemption at all, `producedZone`'s existing `case 'move'` already
covers it. **New `ZONE_MOVEMENT_NAMES` entry added** (`synergy.ts`):
`{ from: 'Library', to: 'Graveyard', name: 'mill' }` — first real card in
the pool with this `(from, to)` pair (grepped every `cards/*/synergy.json`
first, confirmed zero prior). `controller:'opp'` (not `'you'`) on this
fact — a ZONE fact's `controller` names WHOSE ZONE is affected, not the
doer (same established convention self-dies/White Auracite's own
opponent-targeted exile fact already use), confirmed against
`verify-synergy.mjs`'s own `zoneOk` check (`z.side` derived from
`entry.player` = `'opp0'` via `producedZone`'s `case 'move'`) before
committing to it, not just by analogy. Also authored a SINK
`{to:'Hand', controller:'you'}` — "wants cards in your own hand" (the
scaling driver for a bigger mill), mirroring The Wind Crystal's own
"wants creatures on battlefield" sink for its board-wide grant.

**Annotations**: `annotations-authoring.json` (5 source + 1 sink entries,
positionally aligned), `the-water-crystal` added to `ANNOTATED_CARD_SLUGS`
(`scripts/annotation-coverage.mjs`), `compute-annotations.mjs` run scoped
to this slug — 6/6 facts annotated, 0 skipped.

**`find-synergies.mjs` diff** (isolated via `git stash push -- 
cards/the-water-crystal`, old file vs. new, both counted as "v2-shaped" by
this script's loose per-key check so a real before/after was possible):
net +21 (67 vs 46 total lines touching this card). **-17 lost**: all
"graveyard presence" edges that used to come from the OLD file's own bare,
unconditioned `{zone:'Graveyard', controller:'you', subject:'self'}`
SOURCE fact — a presence claim, not a real zone TRANSITION this card's own
ability causes (this card never puts itself in a graveyard as part of any
effect). Correctly dropped per the standing "no presence in sources" rule
(same class of correction Summon: Bahamut's own migration already
established) — verified this was the right call, not a regression, by
checking one of the lost consumers directly (Cantankerous Keepers' own
sink is `{zone:'Graveyard', controller:'you', ...}`, which only the
now-removed self-subject fact ever satisfied — the surviving
`controller:'opp'` mill fact was never eligible for it, `controller`
mismatches). **+38 gained**: all "enters the battlefield" edges, backed by
the newly-authored `self-enters` fact (`to:'Battlefield'`), which the old
file had zero capability for (no self-cast/self-enters facts existed pre-
migration at all).

**Verification**: `verify-synergy.mjs` scoped (both crystals) → 0 hard
failures (1 pre-existing shared soft note each, `legendRule` from
`keywordScenarios`' generic legend-rule scenario — same on both cards,
not new); full pool (320 checked) → 0 hard failures (the 4 hard failures
seen mid-task, and 1 `annotation-coverage.test.ts` failure, both traced to
OTHER concurrent sessions' own in-flight cards — sidequest-card-collection,
sleep-magic, summon-leviathan, valkyrie-aerial-unit — confirmed via
`git status` showing them already modified before this task touched
anything; summon-leviathan's own annotation gap was fixed by whoever owns
it before this task finished, re-confirmed 0/0 at the end). `vitest run
functional-model` → 351/351. `tsc --noEmit` → 0 new errors in any file
this pass touched.

**Real, live file-collision hit mid-task**: `verify-synergy.mjs` got
overwritten by a concurrent session between my first edit (adding the
Water Crystal cost-reduction exemption) and my first verification run —
my line was silently gone, confirmed by re-grepping for it before assuming
anything. Re-applied the same edit against the file's THEN-current state
(also hit one stale-read `Edit` rejection mid-recovery from the file
moving again a second time — re-read fresh each time before retrying,
rather than forcing the stale version through). Final state confirmed
correct via a clean verify-synergy run afterward, not assumed fixed just
because the edit landed. Worth remembering: this file is hot with
concurrent same-day activity (many sessions each closing/opening gaps) —
always re-grep for your own just-added exemption line before trusting a
prior "0 hard failures" result if any time has passed since you last
touched it.

**Open Forge-verification still needed**: none — The Water Crystal's own
Forge script (`the_water_crystal.txt`) was read directly before writing
any fact/gap text, not assumed from Scryfall oracle text alone.

## Thief's Knife (fin/81) migrated to unified Fact model — first real `hasSubtypeReadEvidence` exerciser (2026-09-12)

Same Job-select-Equipment family as astrologian-s-planisphere/dragoon-s-
lance/machinist-s-arsenal/paladin-s-arms/white-mage-s-staff (all migrated
earlier same day). Real Forge citation: `thiefs_knife.txt` — ONE static
ability, `AddPower$1 | AddToughness$1 | AddType$Rogue | AddTrigger$TrigDmg`.

**Went further than every sibling in this batch, per explicit task
instruction**: rather than leaving the +1/+1/Rogue grants real-mechanism-
but-inert (the `isEquippedPTGrantFact`/`isEquippedTypeGrantFact` shape
exemption every sibling relies on, since their `scenarios.ts` are plain
`harness.ts` Scenario[] with no manual-log-injection field), migrated this
card's `scenarios.ts` to a real `engine-trace.ts` pilot (crystal-fragments-
summon-alexander's own style) — first card in the pool to get real
evidence for BOTH `continuousPTGrants` (pump) AND `continuousTypeGrants`
(grantType); first ever real exerciser of `verify-synergy.mjs`'s own
`hasSubtypeReadEvidence` check (wired during gap #14's closure, never
exercised until now).

**Real bug #1 (card-level)**: first draft called `pilotActivate` for the
Equip {4} re-equip with no follow-up `pilotResolveTop` — an activated
ability resolves off the STACK (602.1), so the re-equip silently never
happened (both legality checks reported success; the custom effect's own
`actions.equip` just hadn't run yet). Caught by inspecting the regenerated
trace.json directly (second read pair still showed the ORIGINAL target
unchanged), not by trusting a clean script exit. Fixed by adding the
missing `pilotResolveTop(pilot)` call — mirrors crystal-fragments' own
activate+resolveTop pairing for its transform ability. **Any future
engine-trace.ts pilot script that calls `pilotActivate` must pair it with
`pilotResolveTop` unless the ability is expected to sit on the stack
deliberately** — easy to silently omit since `pilotActivate` itself never
throws for a "forgot to resolve" mistake.

**Real bug #2 (verify-synergy.mjs itself, not just this card)**:
`isEquippedPTGrantFact`/`isEquippedTypeGrantFact`'s own doc comments
claimed a future card with real trace evidence would be recognized
automatically ("hasKeywordReadEvidence/hasSubtypeReadEvidence is checked
FIRST") — **false, and untested until this card**. Traced the actual loop
order in `verify-synergy.mjs`: both shape-scoped exemptions' own
`continue` statements fire BEFORE `hasKeywordReadEvidence`/
`hasSubtypeReadEvidence`/the `pump`-case `producedEvents` branch are ever
computed — so a real card's real evidence is silently exempted away
(never evaluated at all) unless it's ALSO excluded from the exemption BY
NAME, same as `isEquippedPTGrantFact`'s pre-existing `card.name !==
'Crystal Fragments'` exclusion. Fixed by adding `card.name !== "Thief's
Knife"` to BOTH functions; corrected both doc comments to describe the
real mechanism instead of the untested claim. **Any future card that earns
real evidence for one of these shape-scoped exemption families needs the
identical by-name exclusion added — "the evidence exists" alone is not
sufficient, the loop order requires the name carve-out too.** (Same is
almost certainly true of `isEquippedKeywordGrantFact`'s own identical
"checked FIRST" claim — untested by any real card yet, not fixed
speculatively, but worth checking first if a future Equipment card gets a
real `read:hasKeyword` line.)

Facts (7: 6 source, 1 sink): self-cast, self-enters (typeLine-anchored,
baseline pair) — Job-select token-creation ETB — pump (`+1/+1`, REAL
evidence) — grantType (`Rogue`, REAL evidence, first in pool) — granted
`drawCard` (onEquippedDealsDamage-as-self simplification, buster-sword/
genji-glove precedent, REAL evidence via the manually-fired trigger) —
standard Equip sink.

Verified: `verify-synergy.mjs` scoped (OK) + full pool (320 checked, 3
pre-existing unrelated hard failures — black-mage-s-rod/stolen-uniform/
the-water-crystal, all mid-edit by a concurrent session at the time,
`event:damage`/`event:equip`/`event:costReduction` mismatches, nothing to
do with this task). `vitest run functional-model`: 351/351. `tsc
--noEmit`: 0 errors. `find-synergies.mjs` isolated diff (Thief's Knife's
own outbound lines only, given how much concurrent work is in the tree):
129 -> 175 (+46) — same exact breakdown class paladin-s-arms/machinist-s-
arsenal's own migrations already established (11 renamed+duplicated
unconstrained matches, ~33 genuinely new type-constrained "wants Artifact/
Equipment entering" matches via self-enters' own `subject:'self'`). Zero
pump/grantType/drawCard-driven matches gained (expected — no sink in the
pool wants any of those three event shapes yet).

**Open Forge-verification**: none needed — oracle text/mana cost/type line
confirmed against both `data/fin/fin_scryfall.json` #81 and the real
`thiefs_knife.txt` script directly.

---

## sidequest-card-collection-magicked-card (fin/73) migrated to the unified Fact model (2026-09-12)

Transform DFC: front "Sidequest: Card Collection" ({3}{U}, Enchantment,
real ETB draw-3-discard-2 + a real end-step graveyard-count-conditional
transform), back "Magicked Card" (Artifact — Vehicle, 4/4, Flying + Crew
1). Read `SYNERGY_DESIGN.md`/`ENGINE_GAPS.md` fresh first per the task's
own instruction; used `jill-shiva-s-dominant-shiva-warden-of-ice` (freshest
fully-migrated transform DFC that day) as the direct house-style precedent,
`magitek-armor`/`cargo-ship`/`the-lunar-whale` for real Crew machinery.

**Key finding: this card's transform is NOT the Jill/Dion/Jecht shape.**
Those 3 cards' own front-face activated ability literally says "Exile X,
then return it to the battlefield transformed" — a real zone-change
(`actions.moveTo(ctx.self,'Exile')`/`'Battlefield'`) plus a separate
explicit `saga.ts.transformPermanent` call. This card's own oracle is a
PLAIN CR 712 "transform this enchantment" — no exile, no zone change at
all. Checked `saga.ts.transformPermanent` before assuming it needed
adapting: it doesn't — it just does
`engine.resolvedPermanents.set(real.id, {card: newFace, ctx, actions})`
then calls `advanceSaga` (which correctly no-ops for a non-Saga `newFace`
via `isSaga()`'s typeLine check). So a plain transform reuses the IDENTICAL
primitive with zero new code, just no `actions.moveTo` calls needed
alongside it. Confirmed by actually running it in a real engine-piloted
scenario, not just reasoning about the source.

**First real card in the pool to declare `on:'endStep'`** (ENGINE_GAPS.md
gap #3, closed earlier the same day) — grepped first: Yuna, Hope of
Spira/Ultimecia, Time Sorceress (the two cards that gap's own writeup
names) are both still unmigrated, so this is a genuine first real use, not
a retread. Real trace evidence obtained by literally advancing the pilot
through the rest of the same turn (`while (currentPhase(...) !==
'EndOfTurn') advanceOneStep(pilot);`, same `while`-loop-to-a-named-phase
idiom `the-lunar-whale`'s own scenario already uses for `'Main2'`) — no
extra turn/draw-step needed since Main1→EndOfTurn stays within turn 1.
`engine.ts`'s `fireOnPhaseEnterTriggers` auto-fires the trigger the instant
`currentPhase` becomes `'EndOfTurn'`, genuinely running `definition.ts`'s
own `onEndStep` custom effect.

**The CR 603.4 intervening-if ("if eight or more cards are in your
graveyard") is a REAL check, not a documentary stand-in** — the custom
effect's `run()` calls `ctx.you.getCardsIn('Graveyard').length` for real
(same technique `golbez-crystal-collector`'s own "if you control four or
more artifacts" gate already establishes, though that card is still
v1-shaped/unmigrated) — this logs a genuine `read:getCardsIn` trace line
(count:8 in this card's own scenario: 6 real seeded FIN cards + 2 just
discarded). But there's genuinely NO Fact for this condition or for the
transform it gates: (a) no generic, non-type-filtered zone card-COUNT Fact
vocabulary exists anywhere in this model (checked the whole pool — every
real Graveyard-presence want is type-filtered, "a Creature card in your
graveyard," never a bare count), and (b) the transform itself has no zone
movement to anchor a fact to (see above — unlike Jill/Dion/Jecht). Flagged
as a real, documented `knownGaps` entry, not silently dropped or
force-fit into existing vocabulary.

**Two real, GENERAL (not this-card-only) fixes to
`scripts/verify-synergy.mjs`**, both surfaced because this is the first
card combining crewCost-on-a-BACK-face with an engine-piloted Crew
activation:
1. `isCrewCostCreatureWant(w, card)` only ever checked the front-level
   `card?.crewCost` — every prior crewCost card (Magitek Armor, Cargo Ship,
   The Lunar Whale) is single-faced, so this never mattered before. Fixed
   to `!!(card?.crewCost ?? card?.backFace?.crewCost)` — general, not
   name-scoped, since ANY future transform DFC with Crew on its back face
   would hit the identical gap.
2. New `isSidequestCardCollectionGraveyardThresholdRead` (reverse
   aggregate-read exemption) for the real `read:getCardsIn` on Graveyard
   the `onEndStep` condition performs. Deliberately NAME-scoped, not
   shape-scoped like the structurally-similar `isPlayFromLibraryTopPeekRead`
   — grepped the whole pool (all `data/*/*_scryfall.json`, both `card_faces`
   and single-faced) for any other "[N] or more cards are in your
   graveyard"-shaped clause before deciding scope: this is currently the
   ONLY real FIN card with one, so there's no second real case yet to
   verify a shape-scoped generalization against (same discipline
   `isCloudUltimaWeaponComboRead`'s own name-scoping already establishes for
   a genuinely one-off situation) — revisit if/when a second real card with
   this clause shape shows up.

**Facts modeled**: 6 source (front: self-cast/self-enters baseline,
ETB drawCard(3)/discard(2) — same real loot-shape precedent
`qiqirn-merchant`'s own "cantrip" establishes, discard as a produced SOURCE
fact per that card's own convention; back: `event:'crew'`/`event:'grantType'`
Crew 1 machinery, byte-identical oracle span to magitek-armor/cargo-ship's
own since the Crew 1 reminder text is verbatim shared) + 1 sink (back-only
creature-to-crew want, `isCrewCostCreatureWant`-exempted). Flying stays a
bare, factless keyword (2026-09-12 standing rule). No back-face baseline
self-enters (Magicked Card never independently "enters" — same permanent
object flipping face, not a fresh ETB, matching Jill/Dion's own
front-face-only-baseline precedent).

**Scenario**: ONE real, fully engine-piloted `runEngineScenarios()` — cast
→ real ETB draw-3/discard-2 (graveyard 6 seeded real FIN cards, spanning
every major type: Iron Giant, A Realm Reborn, Relm's Sketching, Fight On!,
Wastes, Coeurl — plus 2 discarded = 8) → real turn passage to the real end
step (real graveyard-count read) → explicit `pilotTransform` → real Crew 1
activation (`pilotActivate` with a real `crewedBy:[Ahriman]`, a 2-power
creature seeded on the battlefield) → real `animate`.

**Verification**: `verify-synergy.mjs` scoped 0 hard failures (soft notes:
4x tapForMana, 1x transform, 1x tap-the-crewer, same mechanical-scaffolding
class every other engine-piloted DFC/Crew scenario already produces); full
pool 0 hard failures from this change (re-ran later and saw 7 unrelated
hard failures appear — confirmed via `git status` that all 7, al-bhed-
salvagers/sahagin/stuck-in-summoner-s-sanctum/summon-leviathan/thief-s-
knife/ultros-obnoxious-octopus/valkyrie-aerial-unit, are OTHER concurrent
sessions' own in-progress migrations, none touching crewCost/backFace/
graveyard-count machinery — not caused by this task). `npx vitest run
functional-model`: 351/351. `find-synergies.mjs` diff (isolated old-v1-vs-
new-v2 swap, filtered to this card's own name): before 9 lines (all
illegitimate `Sidequest: Card Collection --[graveyard presence]-->X` — the
old v1 bare-presence SOURCE fact, correctly removed); after 131 (~119 real
Battlefield/entersBattlefield-shaped matches via self-cast/self-enters, ~11
outgoing "enters the battlefield" matches into other cards' own generic ETB
payoffs, 2 "discard" matches). Zero crew/grantType/creature-want matches
yet (new vocabulary, no pool-wide consumer sink exists today) — same
"vocabulary now real, matched later" shape every other fresh promotion
already established. `tsc --noEmit`: zero new errors in any file this pass
touched.

**Real incident, worth remembering**: an early `git stash push -m ... --
<paths>` + `git stash pop` to isolate a scoped check somehow left this
card's own tracked files (and `verify-synergy.mjs`) reverted to their
pre-task HEAD content even though `git stash pop` printed no error — `git
status` for those exact paths showed clean/no-diff afterward, i.e. the pop
silently didn't restore them (root cause not fully understood — possibly
stash's own untracked-file conflict list from OTHER concurrent sessions'
unrelated new files caused it to only partially resolve). Recovered via
`git stash apply` (also silently no-op for these paths) and finally `git
show stash@{0}:<path>` to confirm the stash itself still had my content
intact, then `git checkout stash@{0} -- <path>` per file to force-restore
it, verified via `md5sum` match, THEN `git stash drop`. Lesson for next
time: avoid `git stash` entirely for a scoped, single-task check when the
tree already has this much unrelated concurrent uncommitted work in it —
a plain `git diff --stat -- <own files>` (no stash at all) is enough to
confirm just-touched files landed, same conclusion gap #4's own writeup
above already reached, now with a concrete near-miss to back it up.

**Open Forge-verification still needed**: none — oracle text/mana
cost/type line/keywords confirmed against `data/fin/fin_scryfall.json` #73
directly (`card_faces` shape, both faces' `oracle_text`/`type_line`/`power`/
`toughness` read verbatim); Crew 1's reminder text and CR 712 transform
semantics are core, already-cited comprehensive-rules/keyword mechanics,
not new card-script vocabulary needing a fresh `cardsfolder.zip` cross-check.

## summon-shiva (fin/78) migration, 2026-09-12

Real Saga (non-transforming — the "Summon: Shiva" here is a plain
Enchantment Creature — Saga Elemental, NOT the same card as Jill, Shiva's
Dominant // Shiva, Warden of Ice, a different transforming DFC entirely;
double-checked before starting so as not to conflate the two). Both real
engine primitives it needed were already CLOSED per ENGINE_GAPS.md before
this task started: Saga lore-counter automation (`saga.ts`) and real stun
counters (`state.ts`'s `untap` chokepoint, Ice Flan/Tonberry precedent) —
reused directly, zero new engine work required. `Card.isTapped()` also
already existed (interfaces.ts) — the OLD `definition.ts`'s chapter III
comment claiming otherwise was stale (same stale claim summon-primal-
garuda's own file had already corrected on an unrelated card/effect).

Rewrote chapter I/II from a `custom` no-op-adjacent workaround to real
`tapTarget`+`putCounterTarget` (owner:'opponents', counterType:'stun') —
Ice Flan's own onEnter trigger is the exact real-text precedent ("Tap
target X. Put a stun counter on it."), reused verbatim. Chapter III is now
a real live `Computed<number>` drawCard amount
(`ctx.opponents.flatMap(p=>p.getCreaturesInPlay()).filter(c=>c.isTapped()).length`)
— the first FIN Saga chapter in the pool with a board-counted variable
draw (Bahamut's own chapter III is a fixed 2).

**Real find while building the scenario, worth remembering for any future
Saga scenario with a chapter-I-stunned target**: a Saga's own fixed
clockwork means chapter I -> III always spans TWO of the opponent's own
untap steps, but chapter II -> III only ONE — a stun counter only delays
exactly one untap, so chapter I's own stunned target normally sheds its
counter AND genuinely re-untaps again before chapter III ever fires. A
naive "opponent has 2 creatures, tap one each chapter" scenario would
trivially undercount to 1 tapped creature by chapter III, not actually
demonstrating scaling. Fixed by giving the scenario a second, INDEPENDENT
real tap: once chapter I's target sheds its counter and re-untaps, the
scenario has the opponent genuinely ATTACK with it during their own
following combat (a real, unrelated tap, via `pilotDeclareAttackers`/
`pilotDeclareBlockers`/`pilotResolveCombatDamage`, same helpers adelbert-
steiner/diamond-weapon already use, plus diamond-weapon's own
`advanceToPlayersNextMain1(pilot, pilot.opponents[0]!)` precedent for
advancing to the OPPONENT's own next Main1/combat rather than "yours") —
while chapter II's own target (only one opponent untap step old) is still
genuinely held by its own counter. Both real, live-tapped by chapter III:
verified via two real `read:isTapped` lines (both true) followed by two
real `drawCard` lines in the regenerated trace, not a hardcoded 2.

**Real, pre-existing gap found in `compute-weights.mjs`, not fixed this
pass**: `sourceMagnitude` has NO case for `event:'drawCard'` at all (grepped
the whole file, confirmed) — falls through to the neutral-floor default
(1) instead of reading real trace magnitude. This silently affects
Summon: Bahamut's own already-migrated chapter III fact too (currently
sitting at a correct, hand-set 4) — rerunning `compute-weights.mjs
--slug=summon-bahamut` today would WRONGLY reset it to 1. Hand-corrected
summon-shiva's own fact to 4 (2 real draws this trace, `valueFromMagnitude`
bucket) rather than trusting the script's output. Not fixed generally in
this pass: a correct fix needs to isolate a specific effect's own caused
draws from ordinary per-turn draw-step draws inside a multi-turn
engine-piloted trace (the log has BOTH kinds of `drawCard` entries mixed
together with no per-entry attribution) — the existing `countOf`/
`maxAmount` helpers can't do this safely without risking overcounting on
every OTHER multi-turn scenario that also has natural per-turn draws
in its own log (which is most of them). Flagged here rather than
papered over; worth a dedicated pass if another drawCard-scaling card
comes up.

Facts: 10 source + 2 sink, all real-annotated (compute-annotations.mjs,
card added to `scripts/annotation-coverage.mjs`'s ANNOTATED_CARD_SLUGS).
Baseline self-cast/self-enters (typeLine-anchored) + chapter I/II tap+stun
pairs (repeated per real occurrence, Ice Flan/Jill/Dion precedent) +
chapter III drawCard (real evidence, hand-corrected value) + LORE counter
(real evidence via saga.ts) + sacrifice ACT/dies CONSEQUENCE pair (bare
tag + zone'd consequence, same treatment Summon: Bahamut's own identical
"Sacrifice after N" gets). Sinks: chapter I/II's own target precondition
+ chapter III's own "wants tapped opponent creatures" want — deliberately
TWO separate facts despite an identical constraint shape, since each
anchors a different real sentence (no precedent anywhere in the pool for
one fact carrying more than one annotation entry — checked, kept the
one-fact-one-anchor convention rather than inventing a multi-entry case).

Verified: `verify-synergy.mjs` scoped (0 hard failures, only expected soft
notes — tapForMana/untap/attack background noise) + full pool (320
checked, 3 pre-existing unrelated hard failures — black-mage-s-rod/
stolen-uniform/the-water-crystal, concurrent-session in-flight work, not
this task). `vitest run functional-model`: 351/351. `find-synergies.mjs`
isolated diff (old v1 bare-`putCounter` fact matched 0 pool-wide either
direction before): 0 -> 36, all new — 11 "enters the battlefield" (new
self-enters baseline) + 25 "dies" (new merged dies fact) matches. Chapter
I/II's own tap/stun facts and both sinks currently match 0 — real,
documented pool-authoring gaps (no other card sources a bare `event:'tap'`/
stun-counter producer yet, and no pool card's own self-enters fact
currently satisfies either of this card's own sinks), not fabricated.

**Open Forge-verification**: none needed — oracle text/mana cost/type
line/P-T confirmed directly against `data/fin/fin_scryfall.json` #78.

- **2026-09-12 (latest+42) — Ardyn, the Usurper (fin/89) migrated to the
  unified v2 Fact model.** Old file wasn't string-key v1, but predated the
  09-11 SOURCE rework (`zone` not `to`/`from`), had no `annotations`, and
  carried two bare-presence v1 facts with no real oracle-text basis
  (`self-graveyard`, `self-dies` — Ardyn has no death clause at all) —
  dropped per the standing "SOURCE facts describe real transitions, never
  bare presence" rule (summon-bahamut's own `self-battlefield` precedent).
  8 source + 2 sink facts, all annotated, `ANNOTATED_CARD_SLUGS` grown.
  The 3 real `grantKeyword` facts (Menace/Lifelink/Haste to Demons, backed
  by the already-real `continuousKeywordGrants` mechanism, gap #14) were
  reformatted only, not rebuilt. **New**: extended the "Lifelink always
  means lifegain-source" standing exception to a GRANTED (not printed)
  Lifelink for the first time — added a real `event:'lifegain'` fact
  (`target:{types:{has:['Demon']}}`) since Ardyn's Demons genuinely gain
  him life via `state.dealDamage`'s real `effectiveKeywords` check.
  `rosa-resolute-white-mage`/`zidane-tantalus-thief` have the identical
  granted-Lifelink shape and do NOT have this fact yet — flagged, not
  fixed (out of scope). The graveyard-exile ("exile up to one target
  creature card from a graveyard") got a real `from:'Graveyard',
  to:'Exile'` zone-shaped fact (well-defined origin, unlike Phoenix Down's
  own unspecified-origin bare `event:'exile'` shape) — different from
  Phoenix Down on purpose, checked against that precedent first. The
  created token's own `entersBattlefield` fact uses NEW `tokens.ts` entry
  `b_5_5_demon` (`subject:{token:...}`, Dwarven Castle Guard's fixed-shape
  precedent) — deliberately NOT Relm's Sketching's `target:{types:
  {hasAny:[...]}}` variable-copy shape, since Ardyn's token always has the
  same fixed P/T/color/types regardless of which creature was exiled
  (only its name varies, at runtime, in `definition.ts`'s own untouched
  `custom` effect).
  **Beginning-of-combat auto-fire confirmed NOT built** (`turn.ts`'s
  `CombatBegin` phase has no trigger hook, `engine.ts`'s
  `fireOnPhaseEnterTriggers` only handles upkeep/endStep) — same gap
  `weapons-vendor`'s own migration (also same-day, also a beginning-of-
  combat card) already flagged; left as a documented gap rather than
  building new engine machinery as a side effect of this fact-only task.
  `scenarios.ts` untouched (2 scenarios: 1 explicit + keywordScenarios'
  automatic legend-rule extra — already at the "default 1 + automatic
  extra" shape every Legendary creature gets; the task's own "trimmed
  4->3" framing didn't match the actual current file, already at 2).
  **Real find-synergies.mjs diff, isolated within one process against a
  held-fixed pool snapshot** (a naive before/after whole-script run was
  confirmed CONTAMINATED by concurrent sessions actively editing other
  cards' synergy.json mid-comparison — verified by re-running the
  identical "before" swap twice and seeing 258 unrelated diff lines
  appear; the isolated single-process/single-snapshot version is the only
  trustworthy measurement here): -35/+157. All 35 losses trace directly to
  the 2 dropped bare-presence v1 facts (plus a pure relabeling of the old
  unconstrained "battlefield presence" fact into "enters the battlefield",
  net zero across those 11). ~130 of the 157 gains are a genuine BUG FIX:
  the v1 self-enters fact never declared `subject:'self'`, so
  `resolveSubject(undefined,...)` (deliberately `undefined` by design, the
  Gaius van Baelsar precedent) meant it could only ever satisfy
  UNCONSTRAINED battlefield-presence sinks — every real type-constrained
  "a Creature enters" want pool-wide was invisible to Ardyn despite him
  genuinely being a Creature. ~19 are the new token-enters fact
  independently re-satisfying the same unconstrained sinks a second time;
  3 are the new lifegain fact matching real payoffs (Aerith Gainsborough,
  Excalibur II, Minwu, White Mage).
  Also found+fixed a real, unrelated concurrency incident mid-task: another
  session's write clobbered my first edit to `verify-synergy.mjs`'s
  `isArdynDemonGrantFact` between two of my own tool calls (confirmed via
  a before/after full-pool verify-synergy re-run showing the exemption
  had silently reverted) — reapplied once, re-verified stable after.
  `verify-synergy.mjs` (scoped) 0 hard failures; full pool 320 checked, 7
  hard failures, none on this card (confirmed pre-existing/concurrent,
  unrelated to this task's own edits — `al-bhed-salvagers`, `sahagin`,
  `stuck-in-summoner-s-sanctum`, `summon-leviathan`, `thief-s-knife`,
  `ultros-obnoxious-octopus`, `valkyrie-aerial-unit`). `vitest run
  functional-model` 351/351. `tsc --noEmit` — zero new errors in any file
  this pass touched.

  **Open Forge-verification**: none needed — oracle text/mana cost/type
  line/P-T confirmed directly against `data/fin/fin_scryfall.json` #89 at
  the start of this task.

## 2026-09-12: ENGINE_GAPS.md gap #9 (First/Double Strike combat sub-step) — CLOSED for real

Was previously "folded into gap #1" with only the DAMAGE MATH already
correct (two internal passes inside one `resolveCombatDamage` call, no
real `turn.ts` phase). Closed for real this pass:

- `turn.ts`: `PHASES` now literally includes `'CombatFirstStrikeDamage'`
  between `'CombatDeclareBlockers'`/`'CombatDamage'` — unconditional,
  structural mirror of real Forge's own 13-entry `PhaseType` enum
  (`PhaseType.java` lines 16-28). `advancePhase` itself stays dumb/
  unconditional (no new params) — turn.ts has no combat state to decide
  real 510.5 conditionality with, by design (same reason combat logic
  itself lives in engine.ts).
- `engine.ts`: new `combatHasFirstOrDoubleStrike(engine)` (via
  `effectiveKeywords`, so a GRANTED First Strike — Coral Sword's own Equip
  trigger — counts) + `doAdvance` auto-skips `'CombatFirstStrikeDamage'`
  outright when nothing qualifies (real Forge equivalent:
  `PhaseHandler.isSkippingPhase`/`onPhaseBegin`, `combat
  .assignCombatDamage(true)` returning false, `Combat.java` ~906-926 —
  Forge always transitions through the phase and just withholds priority;
  this engine skips presenting it at all instead, same observable result,
  no hook to represent the distinction otherwise).
- `resolveCombatDamage` SPLIT into two real exported functions instead of
  two internal passes: `resolveFirstStrikeCombatDamage` (dealsFirst) for
  the real `CombatFirstStrikeDamage` step, `resolveCombatDamage`
  (dealsRegular — UNCHANGED predicate) for the real `CombatDamage` step.
  Shared `runCombatDamageStep` now gates "already out of the fight" via
  `isLethallyDamaged(engine.state, card)` (real, persistent
  `damageMarked`/`deathtouchDamaged` state) instead of a local
  same-call-only `Set` — this is what makes the split SAFE across two
  separate real calls (no double-dealing, no need for an actual
  `state.destroy` between them, though a caller SHOULD still run
  `checkStateBasedActions` for realism/704.3 — same "caller-invoked SBA"
  convention this codebase already established). A caller with no FS/DS
  creature needs zero changes: `resolveCombatDamage` alone, once, is
  byte-identical to its own pre-split behavior.
- Real Forge citations: `Combat.java`'s own `dealDamageThisPhase` (~906-
  916, EXACT match for the `dealsFirst`/`dealsRegular` predicates already
  in this file, confirmed not guessed) and `PhaseHandler.java`'s own
  `COMBAT_FIRST_STRIKE_DAMAGE`/`COMBAT_DAMAGE` cases (~321-344).
- Updated 3 existing FS/DS-specific `engine.test.ts` tests to walk the
  real two-phase sequence (`advance` + `currentPhase` assertions +
  `checkStateBasedActions` between steps) instead of one bare
  `resolveCombatDamage` call; added a 4th test proving a normal-vs-normal
  combat never reaches `CombatFirstStrikeDamage` at all. `turn.test.ts`'s
  fixed-phase-order test updated to expect the new phase in sequence
  (fully generic against `PHASES.length` elsewhere — zero other turn.test
  changes needed).
- Real FIN card demonstration: REWROTE (not new) `keywords/first-strike-
  double-strike/scenarios.ts` (Lightning, Army of One / Giott, King of the
  Dwarves — both real FIN cards on this gap's own assigned list) to
  genuinely advance through the real phase via new `engine-trace.ts`
  helper `pilotResolveFirstStrikeCombatDamage`, asserting
  `currentPhase(...) === 'CombatFirstStrikeDamage'` (throws if not reached
  — a real trip-wire) with a real `checkStateBasedActions` sweep before
  the regular step. Regenerated `trace.json` shows real separate
  `{fn:'phase', phase:'CombatFirstStrikeDamage'}` entries.
- Checked all OTHER 9 real FIN cards referencing First/Double Strike
  (Tonberry, Coral Sword, Seifer Almasy, Sidequest: Play Blitzball //
  World Champion Celestial Weapon, Squall SeeD Mercenary, Genji Glove, The
  Masamune, Cloud Planet's Champion, Magitek Scythe) — regenerated every
  one's `trace.json`, BYTE-IDENTICAL (zero regression), clean
  `verify-synergy.mjs`. None of their own scenarios currently drive a
  real FS/DS creature through combat (Tonberry's own First Strike is a
  real but TURN-CONDITIONAL self-grant left as undemonstrated freeform
  `staticAbilities` text — same real, not-yet-retrofitted gap
  `continuousKeywordGrants`'s `onlyDuringYourTurn`/`includeSelf` shape
  could close, flagged in ENGINE_GAPS.md gap #9's own writeup, NOT done
  this pass; The Masamune's "first strike while attacking" is the same
  kind of unmodeled freeform text, pre-existing/flagged in its own
  definition.ts).
- Real, still-open simplification (documented in ENGINE_GAPS.md #9, not a
  new gap): multi-blocker damage ASSIGNMENT ORDERING (509.2) untouched,
  same as gap #1's own pre-existing note; Forge's "always transition
  through the phase, silently" vs. this engine's "never present it"
  divergence is deliberate, not a bug.
- `vitest run functional-model`: 366/366. Full-pool `verify-synergy.mjs`:
  320 checked, 0 hard failures. Scoped verify-synergy on all 11 real FIN
  FS/DS cards: 0 hard failures.
- **Collision note**: gap #17 (extra-phase-within-a-turn) was flagged as a
  concurrent, separate agent's own work on `turn.ts`'s phase machinery —
  re-checked `turn.ts` fresh via `git status`/`git diff` immediately before
  my own edit; it hadn't touched `turn.ts` at all by the time I landed
  (only gap #18/#19, unrelated activation-lock/mill work, touched
  `engine.ts`/`engine.test.ts` concurrently — merged cleanly, confirmed via
  diff inspection, no corruption).
- No further Forge verification needed for THIS gap — the two-step
  split, conditional-skip mechanism, and per-step predicates were all
  checked directly against real `Combat.java`/`PhaseHandler.java`/
  `PhaseType.java` source (`tmp/mtg-forge`), not guessed.

## 2026-09-12 (later still): ENGINE_GAPS.md gap #18 CLOSED — a static effect locking a DIFFERENT permanent's own activated-ability activation

- Checked full FIN pool first (`data/fin/fin_scryfall.json`, grep every
  "activated abilities can't be activated"-shaped clause): Stuck in
  Summoner's Sanctum (fin/76) is the ONLY real card needing this,
  confirmed not assumed.
- Real Forge citation: `res/cardsfolder/s/stuck_in_summoners_sanctum.txt`
  line 11 — `S:Mode$ CantBeActivated | ValidCard$ Permanent.EnchantedBy |
  Secondary$ True | ...` (`StaticAbilityMode.CantBeActivated`,
  `StaticAbilityMode.java` line 22), checked live at
  `AbilityActivated.checkRestrictions` (line 109,
  `!StaticAbilityCantBeCast.cantBeActivatedAbility(...)`), itself sweeping
  every battlefield card's static abilities for a matching `ValidCard`
  (`StaticAbilityCantBeCast.java` lines 55-71/156-160) — BEFORE any
  cost-affordability check.
- New general vocabulary, mirrors `continuousKeywordGrants`'s own shape
  exactly (per the task's own explicit instruction to do so): `card.ts`'s
  `CardDefinition.activatedAbilityLock?: ContinuousGrantTargeting[]` (no
  extra payload beyond the shared `includeSelf`/`subtype`/
  `onlyDuringYourTurn`/`equippedBySelf` targeting — presence in the array
  already means "locked"); `state.ts`'s duck-typed `RealCard.
  activatedAbilityLock` (copied at `resolveTop` time, same convention its
  siblings use); `state.ts`'s new `isActivationLocked(state, card)` sweeps
  the battlefield via the SAME shared `qualifiesForContinuousGrant` helper
  `effectiveKeywords`/`effectivePT`/`effectiveSubtypes` already use.
  `engine.ts`'s `canActivateAbility` calls it right after the controller
  check, BEFORE any cost-shape/affordability check — same order Forge
  itself checks it in.
- Stuck in Summoner's Sanctum's own real shape: `{ includeSelf: false,
  equippedBySelf: true }` — the lock follows this Aura's own live
  `attachedToId` link.
- **Two more real, necessary bugs found and fixed in this same card's own
  `definition.ts`** while actually trying to demonstrate this end-to-end
  (not assumed, not hypothetical — the card was otherwise structurally
  incapable of ever setting a live `attachedToId` at all): (1) its
  `onEnter` trigger was a bare declarative `{kind:'tapTarget', ...}` with
  NO `actions.equip` call — this Aura never actually attached to
  anything, ever, in this model, regardless of any grant field; fixed to
  a real `custom` effect doing both the attach and the tap (mirrors
  sleep-magic's own onEnter trigger, fin's other real Aura, which already
  had this right). (2) the trigger was also missing `on: 'enter'` (present
  on sleep-magic's identical trigger, absent here) — without it,
  `engine.ts`'s real ETB auto-fire never picks the trigger up when cast
  through the real engine path at all.
- `cards/stuck-in-summoner-s-sanctum/scenarios.ts` migrated from a flat
  `harness.ts` scenario to a real engine-piloted one (`runEngineScenarios`)
  — casts the Aura (Flash) onto a real Coeurl (fin's own real `{1}{W},
  {T}: Tap target creature.` creature, chosen specifically because it has
  a real activated ability to lock), then uses `engine-trace.ts`'s
  `pilotExpectIllegalActivate` (the FIRST real pool card to use the
  `pilotExpectIllegal*` helper family at all) to show Coeurl's own ability
  genuinely rejected — real `fn:'illegalAttempt'` trace evidence with the
  actual CantBeActivated reason. `scripts/verify-synergy.mjs`'s
  `IGNORED_FNS` gained `illegalAttempt` (purely observational by that
  helper family's own doc comment, never produce-relevant by
  construction — classified with `cast`/`trigger`/`phase`, not
  `PARKED_ACTION_FNS`).
- Real fact authored: `event:'grantKeyword'`, `keyword:
  'CantActivateAbilities'`, `target:{equippedBySelf:true}`, `value:-1`
  (a lockdown, not a boon — same `value:-1` convention sleep-magic's own
  `CantUntap` fact established). `annotations-authoring.json`/
  `synergy.json` both updated, annotations regenerated via
  `compute-annotations.mjs` (this card is already in
  `ANNOTATED_CARD_SLUGS`). `progress.json`'s `knownGaps` trimmed to just
  the still-open "doesn't untap" half.
- Tests: `state.test.ts`'s new `isActivationLocked` describe block (5
  cases: locked permanent refused, a different permanent unaffected,
  removing the locking permanent lifts the lock live, re-attaching moves
  the lock live, no-lock negative baseline), `engine.test.ts`'s matching
  `canActivateAbility` describe block (3 cases, same shape through the
  real entry point).
- `vitest run functional-model`: 366/366. Scoped + full-pool
  `verify-synergy.mjs`: 320 v2 cards checked, 0 hard failures (the usual
  pre-existing `equip`/`tapForMana` soft notes only, same as every other
  Equipment/Aura-shaped and engine-piloted card in the pool already gets).
- The "doesn't untap during its controller's untap step" half of this
  same card's clause stays OPEN, unchanged, deliberately not attempted
  (shared with sleep-magic — `state.ts`'s `untap()` only special-cases the
  STUN-counter replacement, no general per-object "can't untap" lock).
- **Concurrency note**: this session ran concurrently with at least two
  other engine-agent sessions actively editing `engine.ts`/`state.ts`/
  `card.ts`/`turn.ts`/`harness.ts` in the SAME working tree (gap #19 mill/
  The Water Crystal work, gap #9 First/Double Strike combat sub-step
  work — the latter's own notes entry above independently confirms
  checking for and finding no collision with this gap's own changes). A
  full-pool (unscoped) `run-scenarios.mjs` call made mid-task to
  "sanity-check the whole pool" was a mistake — it's a WRITE, not
  read-only, and it baked a concurrent session's mid-flight `.ts` edits
  into this card's own `trace.json` as a side effect, which a later
  (also-concurrent) `git commit` by another session then reset back to a
  stale version in the shared working tree. Caught and fixed by
  re-running the SCOPED `--slug=` regen at the end; no other card's
  checked-in `trace.json` was actually altered by this (verified via
  `git status` — only this card's own file, plus two files already known
  to belong to the concurrent mill work, ever showed as modified).
  Lesson for next time: prefer `verify-synergy.mjs` (read-only) over
  `run-scenarios.mjs` (writes every card's `trace.json`) for a pool-wide
  "did I break anything else" check when other sessions may be active.

## 2026-09-12 (later still): ENGINE_GAPS.md gap #19 CLOSED — real `mill` mechanism/chokepoint + The Water Crystal's own +4 replacement

- Closes the gap this same file's own earlier entry (line ~15484, "The
  Water Crystal (fin/85) migrated... gap #19 opened") left open. Real
  Forge citation unchanged from that entry: `res/cardsfolder/t/
  the_water_crystal.txt`'s `R:Event$ Mill | ActiveZones$ Battlefield |
  ValidPlayer$ Player.Opponent | ReplaceWith$ MillPlus4 | ...` +
  `SVar:MillPlus4:DB$ ReplaceEffect | VarName$ Number | VarValue$ X` +
  `SVar:X:ReplaceCount$Number/Plus.4`; real `Player.mill(int, ZoneType,
  SpellAbility, Map)` at forge-game/.../player/Player.java ~line 1539; real
  `MillEffect.resolve`'s own `numCards <= 0` early-return (forge-game/.../
  ability/effects/MillEffect.java).
- **New real chokepoint**: `state.ts`'s `GameState.mill(player, qty)` —
  real per-card top-of-library->graveyard moves, capped at library size,
  NO deck-out flag (checked: real Forge has no CR 104.3c analogue for
  milling, only for drawing). Checks a NEW `activeMillModifier(state,
  millingPlayer)` before finalizing the count.
- **Design call made explicitly** (per the task's own prompt to reconsider
  gap #8b's precedent): `LifegainDouble` sufficed as a bare boolean keyword
  because that replacement was a FIXED 2x with no per-card parameter. This
  replacement's own delta (+4) IS per-card data, so a generic `card.ts`
  `CardDefinition.millModifierGrants?: MillModifierGrant[]` (`{amount:
  number}`) was used instead of a card-specific `'MillPlus4'` keyword —
  mirrors real Forge's OWN `ReplaceCount$ Number/Plus.N`, itself a generic
  "add N" primitive, not a card-specific one. Copied onto `RealCard` at
  `resolveTop`, same convention `spellCostReductionGrants` established.
  `activeMillModifier` sums every OTHER player's battlefield grants (real
  `ValidPlayer$ Player.Opponent` — opposite scoping from
  `activeSpellCostDiscount`'s own `Activator$ You`).
- **New `card.ts` `Effect` kind**: `{kind:'mill', owner: EffectOwner,
  amount: Computed<number>}`, dispatching through a new `Actions.mill`
  (mirrors `discard`'s `playersFor` shape) — genuinely distinct from the
  generic `move` kind specifically so a replacement has something to hook;
  `move` itself is UNCHANGED and still used by every other real mill-
  referencing FIN card (see below).
- `cards/the-water-crystal/definition.ts`: `millModifierGrants: [{amount:
  4}]` replaces the old documentary `staticAbilities` text; its activated
  ability now uses `kind:'mill'` instead of `kind:'move'`.
  `scenarios.ts` fully migrated to ONE real `runEngineScenarios` pilot (the
  old flat scenarios never resolved this permanent through `resolveTop`, so
  `millModifierGrants` could never apply to them regardless of shape —
  dropped as dead code, not kept alongside, matching diamond-weapon/
  qiqirn-merchant's own full-migration precedent, since `run-scenarios.mjs`
  picks `runEngineScenarios` EXCLUSIVELY when present): casts the card for
  real, real turn passage (this engine's own broader-than-real-302.6 {T}-
  cost sickness check applies to ANY permanent, not just creatures — an
  existing, unrelated approximation, not touched), activates with 3 real
  hand cards -> real trace shows `{fn:'mill', qty:7, requestedQty:3}`.
  **Gotcha found while building this scenario**: `handCount` alone
  undercounted — `advanceToPlayersNextMain1` crosses the caster's OWN draw
  step too (not just the opponent's), so a real extra card lands in hand
  before activation; used `handCount:2` + `libraryCount:1` to land on
  exactly 3 at activation time, not 3+1=4.
- New Fact: `event:'millIncrease'` (additive-delta sibling of gap #8b's own
  `lifegainDouble`), backed by a new `verify-synergy.mjs` `case 'mill'` in
  `producedEvents` (fires only when real `qty > requestedQty`) — plus
  `case 'mill'` added to `producedZone`/`explainableFns` so the
  PRE-EXISTING `event:'mill'` zone fact keeps its own evidence now that the
  base ability's own log line is `fn:'mill'`, not `fn:'move'`.
  `annotations-authoring.json`/`synergy.json` updated via
  `compute-annotations.mjs` (this card's real oracle line 1, the "plus four
  instead" clause itself).
- Tests: `state.test.ts`'s new `GameState.mill` describe block (7 cases —
  exact count, per-card top-of-library order, 0-qty no-op never consulting
  the replacement, +4 applying to an opponent, the grant's OWN controller
  milling themselves NOT affected, running out of library caps cleanly
  with no deck-out flag, a replacement-bumped request ALSO capping at
  library size).
- **Scope check, confirmed not just assumed**: grepped all 10 real FIN
  cards referencing mill (`data/fin/fin_scryfall.json`) — only The Water
  Crystal touched. The other 9 (Shinra Reinforcements, Random Encounter,
  Summon: Titan, Town Greeter, Vanille Cheerful l'Cie, Hope Estheim, Terra
  Magical Adept // Esper Terra, Eden Seat of the Sanctum, Jidoor
  Aristocratic Capital // Overture) all still use `kind:'move'` — left
  alone, deliberately, per this task's own explicit scope (real mechanism
  becoming real, not a sweep of every card that mentions mill).
- `vitest run functional-model`: 366/366 (full suite, both this work and
  the concurrent gap #9/#18 sessions' own changes included — none of those
  touched anything this gap's own files depend on). Scoped
  (`--slug=the-water-crystal`... actually `verify-synergy.mjs
  the-water-crystal`) + full-pool `verify-synergy.mjs`: 320 v2 cards, 0
  hard failures.
- **Same accidental-full-pool-write mistake this file's own gap #18 entry
  above independently made and caught** — `run-scenarios.mjs` (no
  `--slug=`) was run once to sanity-check, silently baking a concurrent
  session's mid-flight `.ts` edits into every OTHER card's own
  `trace.json`. Caught via `git status` (308 files unexpectedly modified),
  reverted everything except this card's own file via `git checkout --
  <path>` for every OTHER modified trace.json, then re-ran scoped
  (`--slug=the-water-crystal`) only. Lesson (same as gap #18's own entry):
  always pass `--slug=` when another session may be active.
- **No Forge verification still needed** — every citation above (`Player
  .mill`, `MillEffect.resolve`, the real `R:Event$ Mill`/`ReplaceCount$
  Number/Plus.4` script lines) was checked directly against
  `tmp/mtg-forge` source, not assumed.

## ENGINE_GAPS.md gap #17 closed for real (2026-09-12) — queued extra phase groups

Closed "insert one more of this same step before the turn moves on" —
structurally distinct from `extraTurns`/gap #3 (a whole extra TURN).
Re-read `turn.ts`/`engine.ts` FRESH first per the task's own warning
(gap #9/First-Double-Strike had just landed underneath this task, adding
the real `CombatFirstStrikeDamage` phase) — confirmed the phase list is
now 13 entries and `resolveCombatDamage` is split into two functions;
neither affected this closure's own design.

- **Real mechanism**: `turn.ts` gained `TurnState.queuedExtraPhases:
  PhaseGroup[]` (`PhaseGroup = 'EndOfTurn' | 'Combat'`) and
  `TurnState.phaseGroupEntryCount: Partial<Record<PhaseGroup, number>>`.
  `advancePhase` checks `queuedExtraPhases` for a group whose LAST step
  (`PHASE_GROUP_END`) is the phase currently ending, BEFORE its own
  ordinary next-index/turn-wrap logic, jumping `phaseIndex` back to that
  group's FIRST step (`PHASE_GROUP_START`) when queued, consuming (FIFO)
  the entry. New exports: `queueExtraPhase(turn, group)`,
  `isFirstPhaseGroupOccurrenceThisTurn(turn, group)`.
  Cross-checked directly against `tmp/mtg-forge` (not assumed from card
  scripts alone): `AddPhaseEffect.java` resolves `DB$ AddPhase` by pushing
  onto `PhaseHandler.extraPhases: Map<PhaseType, Stack<ExtraPhase>>`
  (`PhaseHandler.java` line 74), keyed by `AfterPhase$`;
  `PhaseHandler.advanceToNextPhase` (lines 156-174) checks that map FIRST
  the moment the current phase ends. `nCombatsThisTurn`/
  `nEndOfTurnsThisTurn` (lines 76-80, bumped at lines 299/362) and
  `isFirstCombat()`/`Count$FinishedEndOfTurnsThisTurn` (line 969;
  `AbilityUtils.java` lines 2204-2207) are the real Forge counters
  `phaseGroupEntryCount`/`isFirstPhaseGroupOccurrenceThisTurn` mirror.
- **Card-facing vocabulary**: `card.ts`'s new `EffectContext
  .firstPhaseGroupOccurrenceThisTurn?: boolean` (caller-supplied real fact,
  same convention `castFrom`/`mode`/`xPaid` use) and `Actions
  .queueExtraPhase(phaseType: PhaseGroup): void` (declared in
  `interfaces.ts` alongside `delayUntil` — genuinely distinct: that one
  runs an arbitrary callback once a phase is reached, this repeats the
  phase/step ITSELF, re-firing whatever else fires during it too).
  `engine.ts` gained a thin `queueExtraPhase(engine, phaseType)` wrapper
  (same shape as `queueExtraTurn`) and now sets
  `ctx.firstPhaseGroupOccurrenceThisTurn` inside `fireOnPhaseEnterTriggers`
  right before an `'endStep'` trigger fires. `harness.ts`'s
  `loggingActions.queueExtraPhase` just logs (no real `TurnState` in scope
  on that flat path); `engine-trace.ts`'s `pilotActions` override
  genuinely mutates `pilot.engine.turn` via the real wrapper, for a future
  engine-piloted card. New `Scenario.firstPhaseGroupOccurrenceThisTurn`
  field wires the fact into a plain harness trace the same way
  `mode`/`xPaid` already do.
- **Wired for real**: Y'shtola Rhul (`cards/y-shtola-rhul/definition.ts`) —
  its `onEndStep` effect now calls `actions.queueExtraPhase('EndOfTurn')`
  exactly when `ctx.firstPhaseGroupOccurrenceThisTurn` is true. Its own
  `scenarios.ts` demonstrates both the positive case (2 existing scenarios
  + explicit `true`) and a NEW negative-case scenario (`false` — a later
  end step this turn does not re-queue, matching real Forge's own
  `ConditionSVarCompare$ LT1` gate). `progress.json` updated (notes
  appended, `knownGaps` cleared). `trace.json` regenerated via
  `run-scenarios.mjs --slug=y-shtola-rhul` (5 scenarios now, confirmed
  `queueExtraPhase` log lines present/absent exactly as expected).
- **Genuinely NOT touched**: Balthier and Fran / Genji Glove (both already
  exist as real `cards/` entries, migrated earlier — checked before
  assuming otherwise) — their own "additional combat phase" clauses stay
  honest `custom` no-ops. Real Forge citation confirms their OWN trigger
  (not just the `AddPhase` sub-ability) is gated `FirstCombat$ True`
  end-to-end (`genji_glove.txt`/`balthier_and_fran.txt`), and Balthier's
  own clause additionally needs a real "you may pay {cost}. If you do,
  ..." optional-payment gate (established pool convention per
  seymour-flux's own doc comment: model as "always pays," no
  legal-but-declined mechanism exists) — neither attempted here, out of
  this task's scope; only the underlying phase-insertion PRIMITIVE their
  own pre-existing comments already correctly flagged as missing is now
  real. Tifa, Martial Artist (the 4th real card needing this shape) is
  still NOT migrated into `cards/` at all (no `cards/tifa-*` directory) —
  a future migration prerequisite, not created here.
- **verify-synergy.mjs**: added `queueExtraPhase` to `IGNORED_FNS` (real
  turn-structure bookkeeping, never produce-relevant — same bucket as
  `phase`/`delayUntil`), so the new action produces no spurious soft note.
  No new synergy Fact — same "never modeled" treatment `queueExtraTurn`
  (gap #3) already established (a phase-repeat isn't a produce/consume-
  shaped board effect).
- **Tests**: `turn.test.ts`'s new `queued extra phase group` describe
  block (5 cases — extra End Step re-enters once then Cleanup; extra
  Combat re-enters the WHOLE 6-step sequence without re-running
  Upkeep/Draw/Main1; a turn with nothing queued behaves identically to
  before; `phaseGroupEntryCount` resets at turn-wrap).
  `engine.test.ts`'s new `queueExtraPhase` describe block (3 cases) proves
  the real end-to-end wiring: a real `onEndStep` trigger through
  `castSpell`/`resolveTop`/`fireOnPhaseEnterTriggers` genuinely re-fires
  once, does not re-queue a third time, Cleanup still runs afterward; plus
  a regression case. Hit one real test-authoring bug along the way: first
  draft used `manaCost: '{1}{U}'` for the test card, unpayable against
  `setupGame()`'s fixed Forest/Forest/Mountain board (no Island) — fixed
  to `'{1}{G}'`, same cost every other `engine.test.ts` fixture uses.
- Docs: `ENGINE_GAPS.md` gap #17 marked CLOSED with the full Forge-cited
  writeup (kept the original historical narrative, appended the closure
  as a new paragraph, same convention gap #18's entry established).
  `ENGINE_DESIGN.md` gained a new "Queued extra phase groups" subsection
  (API-shape snippet, In-scope bullet, Tests-section paragraph — same
  treatment every other closed gap gets). `SYNERGY_DESIGN.md` got a short
  dated follow-up bullet after the original Y'shtola migration entry
  (append-only log convention — did not rewrite the original entry's own
  "no Fact/no mechanism yet" framing, which was true AT THE TIME).
  `.claude/contracts/state-event-format.md` got a short additive note for
  the new `fn:'queueExtraPhase'` trace-log entry.
- `npx vitest run functional-model`: 373/373 pass (366 baseline + 7 new).
  `verify-synergy.mjs` scoped (`y-shtola-rhul`): 0 hard failures, same
  pre-existing `legendRule` soft note, `queueExtraPhase` note gone after
  the `IGNORED_FNS` fix. Full pool: 320 checked, 0 hard failures (the 4
  previously-reported concurrent-session hard failures are gone — those
  sessions have since committed/fixed them).
- **Caution note for future sessions**: this repo had at least 3 OTHER
  concurrent sessions' uncommitted work in the tree throughout this task
  (`stuck-in-summoner-s-sanctum`, `the-water-crystal`,
  `keywords/first-strike-double-strike`, `state.ts`, `saga.ts`, etc., per
  `git status` — none touched by me). Did one `git stash`/`git stash pop`
  early on to diff a `tsc` baseline — immediately popped back, verified via
  `git status` that nothing was lost, but this is a real risk with
  concurrent sessions active; avoided any further stash/reset/checkout use
  for the rest of the task. Always pass `--slug=`/positional slug args to
  `run-scenarios.mjs`/`verify-synergy.mjs` rather than a bare full-pool run
  when other sessions may be mid-edit (this task's own scoped runs were
  fine; a concurrent session's own notes above already document the
  accidental-full-pool-write failure mode to avoid).
- **No further Forge verification needed** — every citation above
  (`AddPhaseEffect.java`, `PhaseHandler.java` lines 74/156-174/76-80/
  299/362/969-971, `AbilityUtils.java` lines 2204-2207,
  `genji_glove.txt`/`balthier_and_fran.txt`/`yshtola_rhul.txt`) was
  checked directly against `tmp/mtg-forge`, not assumed.

## forceCast retrofit swept across the remaining Job-select-Equipment
## family (2026-09-13) — fin/28 (paladin-s-arms) regression, real user report

Dragoon's Lance got the real `Scenario.forceCast` fix same-day (see its own
entry above) but explicitly did NOT retrofit its 5 siblings, flagged as a
"future upgrade candidate." The user then hit the exact same bug live on
fin/28 (Paladin's Arms): its scenario showed the Job-select ETB trigger
firing with no real cast preceding it — "should have been cast, onEnter
trigger doesn't magically trigger." Root cause was the identical
`trigger:'onEnter'`-at-top-level shortcut dragoon-s-lance's own comment
already documents: starts `self` already on the Battlefield, skips
`cast`/`enters` entirely.

- **Fixed all 6 remaining Job-select-Equipment `scenarios.ts` files**:
  paladin-s-arms, astrologian-s-planisphere, sage-s-nouliths,
  white-mage-s-staff, machinist-s-arsenal, black-mage-s-rod. Each now sets
  `forceCast: true` and moves `'onEnter'` from the top-level `trigger`
  field into the front of `sequence` (`sequence: ['onEnter', {activate:
  true}, ...]`), same real `Scenario.forceCast` mechanism dragoon-s-lance
  established (no new harness.ts code needed — the field already existed
  and worked, this was purely a per-card retrofit).
- **astrologian-s-planisphere was a genuine outlier**: it had never even
  gotten the 2026-09-12 "chain into one continuous story" treatment its
  siblings got — it still had TWO separate scenarios (a bare
  `trigger:'onEnter'` plus a second bare-activate scenario relying on
  `harness.ts`'s automatic top-level `activate`). Consolidated to the same
  one-scenario `forceCast`+`sequence` shape as the rest, preserving the
  real `read:getCreaturesInPlay` sink evidence the old second scenario
  provided (`you: {creaturesCount: 1}`, same "other real creature already
  on the battlefield" convention every sibling uses).
- **sage-s-nouliths** kept its existing 3-step `sequence` (Equip activate +
  the granted `onEquippedAttacks`/untap trigger) — only the `trigger:
  'onEnter'`→`forceCast`+sequence-prefix change was needed, nothing else
  in its chain changed.
- Confirmed via each regenerated `trace.json`: all 6 now show
  `cast → enters → trigger → createToken → equip → activate →
  read:getCreaturesInPlay → equip` (sage-s-nouliths additionally continues
  `→ trigger → read:getCreaturesInPlay → untap`) — a real cast/enters
  lifecycle precedes the Job-select trigger in every one, not a "mythical
  enter."
- Regenerated `trace.json` **scoped per card** (`vite-node
  functional-model/scripts/run-scenarios.mjs --slug=<slug>`, one at a
  time) — never an unscoped run (the documented accidental-full-pool-write
  hazard this same file's own gap #17/#18 entries already flag). `git
  status` before and after confirmed only these 6 cards' own
  `scenarios.ts`/`trace.json`/`progress.json` changed, nothing else in the
  pool touched.
- `progress.json` updated for all 6 with a dated note citing this fix and
  dragoon-s-lance as precedent; `paladin-s-arms`'s own `review` flag was
  `'human'` (from an earlier reviewer pass) and got reset to `'ai'` per
  this project's stale-review-flag convention (authored scenario content
  genuinely changed) — the other 5 were already `'ai'`, no reset needed.
- **verify-synergy.mjs**: scoped run for each of the 6 — 0 hard failures
  each (only the same pre-existing, already-documented soft "equip ...
  with no matching declared produce" notes every Job-select Equipment
  already has, `PARKED_ACTION_FNS`-covered, unchanged in count/shape from
  before this fix). Full pool: 320 v2 cards checked, 3 skipped (still
  v1-shaped, unrelated), **0 hard failures**.
- `npx vitest run functional-model`: 373/373 passed (no regressions).
- **No Forge verification needed for this pass** — purely a harness-side
  scenario-authoring fix reusing the already-Forge-grounded `forceCast`
  mechanism dragoon-s-lance's own same-day entry already cites; no new
  `interfaces.ts` mirror or engine mechanism was touched.
- **Thief's Knife deliberately left alone** — confirmed it already uses a
  full `engine-trace.ts`-piloted `pilotCast` approach (a different,
  also-real technique), not the `harness.ts` `Scenario[]`/`forceCast`
  shape this sweep applies to.

## PRD_AUTOMATED_AUTHORING.md — bounded recognizer-library prototype (2026-09-13)

Built exactly 2 recognizers (not the full PRD — a scoped shape-finding
prototype per explicit task framing), new `functional-model/recognizers/`
directory:
- `types.ts` — `RecognizerInput`/`RecognizedFact`/`FactProvenance`
  (`{origin:'parser', rule: RecognizerId}`)/`RecognizerResult`
  (`{matched:true, facts}` | `{matched:false, reason}` — always a real
  reason string, never a bare boolean).
- `type-line-span.ts` — shared `typeWordsSpan(typeLine)`: strips leading
  supertypes (`Legendary`/`Basic`/`Snow`/`World`/`Ongoing`/`Elite`/`Host`),
  keeps every real card-type word before the em dash. Reverse-engineered
  from the REAL pool's own existing hand-authored `annotations` (checked,
  not guessed) — picks ONE consistent rule where today's hand-authored data
  is itself inconsistent (summon-bahamut's own `cast` fact spans only
  "Creature" while its `entersBattlefield` fact spans "Enchantment
  Creature" for the identical typeLine — a real, observed inconsistency
  this prototype doesn't perpetuate).
- `instant-sorcery-resolves-to-graveyard.ts` (Recognizer A) /
  `permanent-enters-battlefield-normally.ts` (Recognizer B) — each
  produces the exact 2-fact shape already established by hand across the
  real pool (self-cast `{event:'cast', from:'Hand', target:'self',
  value:1}` + either `{to:'Graveyard', controller:'you', subject:'self',
  value:1}` or `{event:'entersBattlefield', to:'Battlefield',
  controller:'you', subject:'self', target:'self', value:1}`). `value:1`
  baked in directly (not the `-1` "pending compute-weights.mjs" sentinel)
  — `compute-weights.mjs`'s own `sourceMagnitude` gives a bare zone fact
  with no token subject a flat magnitude of 1 regardless of card, so
  there's nothing trace-dependent to defer for these two specific facts.
- `synergy.ts`'s `toLineOffset` given `export` (was module-private) so a
  recognizer can build a real `AnnotationRef` straight from its own
  already-known match offset — annotation genuinely IS a byproduct of the
  match now, no `annotations-authoring.json`/`compute-annotations.mjs`
  indirection involved for parser-derived facts.
- `recognizers.test.ts` + `load-fin-cards.mjs` (plain JS reading
  `data/fin/fin_scryfall.json` directly — same "no `.ts` file in this repo
  imports `node:fs` directly, only `.mjs`" convention `annotation-
  coverage.mjs`/`scenario-card-names.mjs` already established, confirmed
  by grep before assuming) — 25 real-card tests, all passing, against REAL
  FIN cards' real printed text, not hand-typed fixtures.
- `functional-model/tsconfig.json` `include` gained `"recognizers/**/*.ts"`
  (same treatment `"cards/**/*.ts"` already gets). Full `tsc --noEmit`
  baseline unchanged at 49 errors (all pre-existing TS5097/TS7016/TS7034
  quirks already documented elsewhere in this repo, none newly introduced
  by this work — the one new TS7016 for `load-fin-cards.mjs` replaces what
  would otherwise have been a `node:fs`-import TS2591, net same count).
  `npx vitest run functional-model`: 398/398 pass (was 373 before this
  session per the last dated entry above; difference includes both this
  session's +25 and other concurrent sessions' own additions already
  landed — not solely this task's delta).

**Real findings from building these** (the actual point of the task):
- **Ground-truthed against the real pool before trusting any assumption**:
  read every migrated card's own `synergy.json` for cards that should
  plausibly accept/decline, rather than guessing from CR text alone.
  Caught 2 real false-positive traps this way, not hypothetically:
  1. An unbounded `enters.*counter`/`enters.*with` regex (recognizer B)
     would have wrongly DECLINED every Saga in the pool — Saga reminder
     text ("As this Saga enters and after your draw step, add a lore
     counter...") contains both words in the same sentence but they're
     unrelated clauses; CR 714.2c confirms a Saga's chapter ability is a
     TRIGGERED ability despite the "As ~ enters" wording, not a
     replacement effect on the entering itself. `summon-bahamut`'s own
     real hand-authored data (has the plain self-cast/self-enters pair)
     confirmed this before the regex got tightened to require "enters"
     immediately followed by the disqualifying word (no unbounded `.*`).
  2. A blind "exile"/"flashback" keyword scan (recognizer A) would have
     wrongly DECLINED every Flashback/"cast from a graveyard" card in the
     pool (`auron-s-inspiration`, `dreams-of-laguna`, `retrieve-the-esper`,
     `from-father-to-son`) — that language describes an ALTERNATE cast
     mode or a conditional bonus, never an override of the normal
     from-hand cast's own resolution. `syncopate`'s "exile it instead of
     putting it into its owner's graveyard" is the sharper version: "it"
     is the COUNTERED spell, not Syncopate itself. Narrowed to requiring
     an explicit self-referential subject ("this card"/"this spell") —
     documented pronoun-antecedent resolution as a known, accepted blind
     spot rather than over-engineering a regex to chase it.
- **One genuine, deliberate divergence from existing hand-authored data,
  kept on purpose**: `zack-fair` ("Zack Fair enters with a +1/+1 counter
  on it") IS currently hand-authored WITH the self-cast/self-enters pair,
  but "enters with a counter" is CR 614.12's textbook replacement effect —
  which the task's own given recognizer-B definition explicitly excludes.
  Recognizer B declines Zack Fair on purpose, disagreeing with today's
  existing per-card judgment call. Non-issue under the overlay model (a
  declined recognizer never removes/contradicts an existing fact) but a
  real, concrete example of exactly what the PRD's own "separate rule
  review lane" is for — flagged in-code, not silently resolved.
- **One likely-latent gap in EXISTING hand-authored data, surfaced (not
  fixed) by building this**: `ultima`'s own reminder text ("End the turn.
  (Exile all spells and abilities from the stack, including this
  card...)") is a real, self-referential override — CR 500.7's "end the
  turn" genuinely exiles the card that caused it, every time, unconditionally.
  Recognizer A correctly declines it. But `ultima/synergy.json` currently
  STILL asserts the plain self-to-graveyard fact by hand — arguably wrong
  given the card's own printed text. Not fixed here (out of this task's
  scope — no per-card synergy.json in the real pool was touched by this
  prototype at all, deliberately: see below), but a concrete demonstration
  that a recognizer library, once trusted, can ALSO serve as a
  consistency-check against already-authored facts, not just a
  boilerplate-authoring shortcut.
- **Real scope-correctness case, not just an override-detection case**:
  `torgal-a-fine-hound`'s "Whenever you cast your first Human creature
  spell each turn, THAT creature enters with an additional +1/+1
  counter..." is about a DIFFERENT creature, not Torgal itself — Torgal's
  own entrance is completely normal. Recognizer B's deny-pattern
  deliberately requires the subject to be "this <type>" or the card's own
  printed name, never a bare pronoun ("it"/"that creature"), specifically
  so this doesn't over-decline.
- **Deliberate scope decision, not an oversight**: this prototype does
  NOT write recognizer output into any real `cards/<slug>/synergy.json` —
  it only computes candidate parser-facts + provenance + annotations
  in-memory (proven via `recognizers.test.ts`, not persisted). Wiring a
  recognizer's output into the real per-card pipeline (when/how it merges
  with agent-authored facts on disk, whether it's a new `parser-
  facts.json` sibling file mirroring `annotations-authoring.json`'s own
  positional-alignment convention or something else) is real future work,
  not attempted here — this task was scoped to "do these two recognizers
  work, and what does building them teach about organization," not "ship
  the pipeline."

**Organizational recommendation for the real library, grounded in the
above** (not abstract): one file per recognizer (not grouped by pattern
family) — each recognizer's own doc comment carries a LOT of
card-specific, ground-truthed reasoning (which real cards were checked,
which false-positive trap was found and how, which existing hand-authored
divergences are intentional) that would get diluted/hard-to-navigate in a
shared multi-recognizer file. A recognizer's public contract should stay
exactly the shape used here: `(RecognizerInput) => RecognizerResult`,
pure/synchronous, zero engine/game-state access — every real disqualifier
found so far is answerable from typeLine + oracle text alone, never
needed live board state. `type-line-span.ts`-style shared helpers
(annotation-span math, name-escaping) belong in small shared modules
recognizers import, not copy-pasted, since the exact span convention
needs to stay identical pool-wide for consistency's sake (see the
Saga/adelbert-steiner span-consistency point above). The single most
important lesson: every deny-pattern in this prototype that shipped
"tight" started as a "loose" version that was empirically wrong against
a real accept-case in the pool — this argues hard for the PRD's own
per-card ground-truthing discipline extending to RULE AUTHORING itself,
not just rule application: a new recognizer should always be run against
at least one real card it's expected to ACCEPT that superficially
resembles a decline-case (Sagas for "enters+counter" wording, Torgal for
"other creature enters" wording), not just against cards it should
decline — the accept-side near-misses are where this prototype's real
bugs actually were, not the decline side.

**Open Forge-verification note for a future session**: none needed for
this task specifically (no `interfaces.ts` mirror or engine mechanism was
touched — this is pure oracle-text pattern matching, no Forge citation
required per this file's own precedent for annotation-only/text-only
work). CR citations above (608.2m, 715.3d, 714.2c, 614.12, 500.7) are
from trained knowledge, not re-verified against a rules-text source this
session — low-effort to double check against a comprehensive rules
mirror if this prototype ever becomes the real, pool-wide library.

## Recognizer prototype wired into real per-card data (2026-09-13, follow-up)

Previous same-day task explicitly stopped short of writing into real
`cards/<slug>/synergy.json` ("real future work, not attempted here"). This
task is that follow-up — full writeup lives in `functional-model/
PRD_AUTOMATED_AUTHORING.md`'s new "Wired into real per-card data" section
and `SYNERGY_DESIGN.md`'s new "`Fact.provenance`" section (both dated
entries, not duplicated here) and `.claude/contracts/card-schema.md`'s new
section (card-facing shape). Short summary for this file:

- New `Fact.provenance?: {origin:'parser', rule:string}` (`synergy.ts`) —
  same "purely informational, not consulted by factsInteract/themeOf"
  bucket as `targeted`/`untilEndOfTurn`. `recognizers/types.ts`'s own
  `FactProvenance` now just re-exports this (moved to be Fact-adjacent
  rather than recognizer-owned, since it's now a real field on the served
  Fact type) — `RecognizerId` stays recognizer-owned (narrower literal
  union, structurally assignable into the plain `string` `rule` field).
- New `functional-model/scripts/apply-recognizers.mjs` — additive,
  idempotent, whole-pool wiring script. Ran for real against all 323 pool
  cards: 202 gained new parser-tagged facts (435 total), 20 skipped (no
  real oracle text — cross-set reference cards outside the FIN corpus), 3
  skipped (still v1-shaped). Dedup key deliberately excludes `value`
  (existing `-1` placeholder vs. recognizer's real `1`) and `controller`
  (a REAL, confirmed pool inconsistency — some existing `entersBattlefield`
  facts declare it, some don't, for the identical claim; Zack Fair's own
  hand-authored fact is one of the ones that omits it) — found this via a
  dry-run that initially over-reported "new" facts before narrowing the
  key, not assumed upfront.
- **zack-fair/ultima (the two side-finding cards) — confirmed via the real
  whole-pool run: zero new facts, zero diff, for both**, exactly matching
  the prototype's own predictions (Zack Fair's "enters with a counter" is
  a real CR 614.12 replacement effect the permanent recognizer declines
  under; Ultima's "exile ... including this card" is a real self-override
  the instant/sorcery recognizer declines under). Neither card's existing
  hand-authored data was touched — Ultima's own arguably-wrong
  self-graveyard fact is still there, still just surfaced not fixed.
- **Real, useful surfaced finding, not just risk-checking**: ~200 cards
  were genuinely MISSING the baseline self-cast/self-enters pair entirely
  (not "already covered" as the prototype's own smaller spot-checked
  sample suggested) — e.g. A Realm Reborn (plain Enchantment, empty
  `source` array before this). The parser is filling in real gaps, not
  just re-confirming already-authored facts.
- **`scripts/verify-synergy.mjs` got one small, principled change**: a
  `provenance.origin==='parser'` produce fact with no supporting trace
  evidence is now a soft note, not a hard FAIL (both the zone-shaped and
  event-shaped evidence-check sites) — triggered by 43 real cards whose
  own `scenarios.ts` never casts them from hand (only exercises their own
  distinguishing ability), which would otherwise hard-fail on a
  boilerplate claim that's true by construction. Verified the TRUE
  before/after via `git stash push -- functional-model/cards` (scoped,
  not a bare stash, to avoid touching other concurrent sessions' unrelated
  in-flight files) + `git stash pop`: 0 hard failures before this task, 0
  after (43 would-be-new hard failures all correctly downgraded, all
  confirmed to be on cards this task's own wiring touched, not
  pre-existing). This is the one real engine-mechanism change beyond pure
  data — flagged explicitly in both PRD/SYNERGY_DESIGN.md/contract
  entries, not slipped in quietly.
- Progress.json untouched anywhere (git status confirms only `synergy.json`
  files changed under `cards/`) — review-status semantics genuinely
  unchanged, per this task's own constraint.
- Verification this session: `npx vitest run functional-model` 398/398
  (unchanged); `tsc --noEmit` (functional-model) 49 errors (unchanged
  baseline); `verify-synergy.mjs` 0 hard failures pool-wide (was 0 before
  too); `verify-annotation-coverage.mjs`/`verify-scenario-card-names.mjs`
  both clean; `find-synergies.mjs` runs clean, new cross-card matches
  appear for previously-fact-less cards as expected.
- **Judgment call worth flagging to the orchestrator/user**: the
  dispatching task said "keep provenance metadata separate from the core
  Fact object (same precedent as AnnotationRef)." `AnnotationRef` itself
  IS a field ON `Fact` (`Fact.annotations`) — the thing kept in a genuinely
  separate FILE is only the pre-computation AUTHORING input
  (`annotations-authoring.json`), which doesn't apply here since a
  recognizer already knows its own provenance at generation time (no
  separate authoring/derivation step needed). Given that, plus this
  codebase's own dense precedent of "structured, documentary-only side
  object living directly on `Fact`" (`targeted`, `untilEndOfTurn`,
  `costReductionPerControlled`, `face` itself), I put `provenance` directly
  on `Fact` rather than a positionally-aligned parallel file/array —
  simplest for `card` to consume (one field per served fact, no
  index-zipping), and consistent with every other "rides alongside,
  doesn't fork the matching vocabulary" field already in this file. Flagged
  here in case the original phrasing meant something stricter (a genuinely
  separate sibling file) — no user pushback expected given the precedent,
  but calling it out rather than silently assuming.
- **No Forge verification needed for this task** — pure data-generation
  wiring plus one reconciliation-script severity change, no
  `interfaces.ts` mirror or engine mechanism touched. The prototype's own
  still-open item (CR citations 608.2m/715.3d/714.2c/614.12/500.7 in the
  recognizer code comments are from trained knowledge, not yet checked
  against a rules-text mirror) remains open, unchanged by this task.

## Second-kind recognizer prototype (2026-09-13): Forge-script-based, not oracle-text-based

Bounded, explicitly NOT wired into `apply-recognizers.mjs` (per this task's
own scope) — a probe of whether reading Forge's own structured card-script
DSL (`tmp/mtg-forge/forge-gui/res/cardsfolder/...`), instead of raw oracle
text, is viable for token-creation facts. Code: `functional-model/
recognizers/forge-script-parser.prototype.ts`, `token-creation-from-forge-
script.prototype.ts`, `token-creation-from-forge-script.prototype.test.ts`
(9/9 passing). Confirmed Moogles' Valor's real script
(`cardsfolder/m/moogles_valor.txt`) has exactly the structured params
expected (`TokenAmount$ X`, `TokenScript$ w_1_2_moogle_lifelink`, resolved
via `tokenscripts/w_1_2_moogle_lifelink.txt`'s own `PT:`/`Colors:`/`K:`
lines) — structured extraction itself DOES work, trivially, for this case.

- **The real open problem (annotation remapping) has a working but
  NOT-free solution**: since Forge's script carries no offset into this
  card's own oracle text, the recognizer independently re-locates the
  matching clause by finding every `create`/`creates` occurrence, bounding
  each to a quote-aware clause end (tracks `"..."` nesting so a token's own
  quoted granted ability, e.g. Circle of Power's, doesn't get cut short by
  its internal period), then keeping only the clause(s) that structurally
  corroborate the JUST-extracted color/P-T/subtype words (unordered
  containment, not an exact phrase match). For Moogles' Valor this
  reproduces the real, existing hand-authored annotation
  (`start:31,end:85`) exactly. This is real, additional Magic-templating
  knowledge (word order varies — "3/3 blue Robot Warrior ARTIFACT creature
  token" vs the script's own `Types: Artifact Creature Robot Warrior`
  order; word presence varies — Treasure's oracle text omits "artifact"
  entirely despite `Types: Artifact Treasure`; quantity words aren't
  cross-checked at all, a known gap) — NOT a free byproduct of parsing
  Forge's fields the way the two oracle-text recognizers get their spans
  for free by construction.
- **Tested against 6 real cards, not cherry-picked**: Moogles' Valor
  (motivating case, exact match), Aerith Rescue Mission + Battle Menu
  (modal bullet-point phrasing), Dwarven Castle Guard (token from a death
  trigger, not cast), Ancient Adamantoise (mid-sentence clause, Treasure's
  "artifact"-omitting wording, a real Forge-literal-vs-trace-value mismatch
  — script says `TokenAmount$ 10`, real `synergy.json` shows `value: 5`,
  confirming `compute-weights.mjs`'s `sourceMagnitude` ALWAYS re-derives a
  token-subject fact's magnitude from the trace regardless of what's
  authored — so this recognizer always emits `value: -1`, never a literal
  Forge count), Circle of Power (quoted inline ability — clause-bounding
  logic verified correct via a direct `findCreateClause` probe, exported
  for exactly this), Retrieve the Esper (genuinely declined).
- **Two REAL, previously-unnoticed catalog-drift findings this prototype
  surfaced, not invented for the test**: (1) `retrieve-the-esper`'s real
  Forge script says `TokenScript$ u_3_3_a_robot_warrior`, but `tokens.ts`'s
  own real entry for this exact token is keyed `u_3_3_robot_warrior` (no
  `_a_`) — Forge's own id and this app's catalog key have silently
  diverged. (2) `circle-of-power`'s real Forge script says `TokenScript$
  b_0_1_wizard_snipe`, which isn't in `tokens.ts` AT ALL — that card's own
  real `definition.ts` builds the token inline instead, yet its own real
  `synergy.json` fact still asserts `subject:{token:"b_0_1_wizard_snipe"}`,
  a string that resolves against NOTHING in the shared catalog today (a
  real, pre-existing, silently-unresolvable fact in the live pool — not
  caused by this prototype, just surfaced by it). This recognizer declines
  both, conservatively, rather than fabricating/normalizing a guessed key.
- **Recommendation, given the above (asked for explicitly in the task
  brief)**: Forge-script-based recognition is NOT worth pursuing as a
  general second recognition strategy in its current form. It technically
  works for the motivating case and a few siblings, but every real card
  checked needed either genuine extra Magic-templating knowledge (the
  annotation remapping) or ran into a real second-source-of-truth drift
  problem (the token-id catalog mismatch) that oracle-text-only recognizers
  structurally cannot have (they only ever read the ONE source they also
  annotate against). Deriving facts from this app's OWN already-typed
  `definition.ts` structures instead avoids both: a `definition.ts`'s
  `createToken` effect already references a real `TOKENS` entry directly
  (compile-time-checked, no string-id drift possible) and any annotation
  work needed there is the same "map structured data back onto this card's
  own oracle text" problem — but solvable ONCE, generically, for every
  `Effect` kind the declarative model already has (not per-source-DSL like
  Forge script parsing would need), and with zero second-source drift risk
  since it's the same file/source of truth. My recommendation: if this
  direction gets picked up again, spend it on facts derived from
  `definition.ts`'s own `Effect[]`, not on reading Forge script directly.
- **Provenance schema, per the task's own open question**: did NOT modify
  `synergy.ts`'s real `FactProvenance` (kept as a literal union of one,
  `origin:'parser'`, per its own doc comment already anticipating "a
  future second non-agent origin" as a deliberate future change, not this
  prototype's call to make unilaterally). My own read: `rule` alone (a
  distinct string like `'token-creation-from-forge-script'`) already fully
  disambiguates this recognizer from the two oracle-text ones by name, so
  a second `origin` literal isn't STRICTLY required — but if a real second
  source ever gets wired in for real, I'd lean toward adding one anyway
  (`origin` and `rule` are two orthogonal axes: "what kind of source" vs
  "which specific pattern", and conflating them into `rule`'s name alone
  is fragile once the rule catalog grows past a couple of entries). Not
  implemented either way — flagged, not decided, since it's moot while
  this recognizer stays unwired.
- **Open Forge-verification note**: none needed beyond what's already
  cited above — every claim here is grounded directly in real files read
  from `tmp/mtg-forge` (cardsfolder + tokenscripts) and this repo's own
  `tokens.ts`/`data/fin/fin_scryfall.json`, not trained-knowledge guesses.

## Absolute Virtue (fin/212) audit — user-reported "shitshow" claim NOT confirmed as literal `custom` stubs (2026-09-13)

Dispatched task assumed the card's abilities were reduced to `kind:'custom'`
text stubs. Checked git history (`34b69e79`, the card's only commit ever) —
never true; the file has always been `keywords: ['Flying']` +
`staticAbilities: string[]` (2 entries), zero `effects`/`triggers`/`custom`
anywhere. Real Forge script confirmed
(`tmp/mtg-forge/forge-gui/res/cardsfolder/a/absolute_virtue.txt`):
`R:Event$ Counter | ... | Layer$ CantHappen` ("can't be countered") and
`S:Mode$ Continuous | Affected$ You | AddKeyword$ Protection:Player.Opponent:...`
("you have protection from each of your opponents") — only `K:Flying` is a
real `K:` line, already correctly structured.

**Conclusion after checking both against real engine machinery**: both
`staticAbilities` strings are the CORRECT, already-established treatment,
not a laziness bug —
- "Can't be countered": no Counter-event/stack-object machinery exists
  anywhere in `stack.ts`/`engine.ts` to intercept (`card.ts`'s own
  `kind:'counter'` Effect is log-only, per its own doc comment, precisely
  because there's no real target to remove). Same real-`R:`-line-stays-text
  treatment `eject/definition.ts` already established for the identical
  clause (pre-existing precedent, unchanged).
- "You have protection from each of your opponents": Forge's own
  `Affected$ You` means this grants the keyword to the CONTROLLING PLAYER,
  not to the creature — CR 702.16e, mechanically distinct from
  creature-level protection (which also implies "can't be blocked," 702.16b
  — this card's own reminder text omits that clause on purpose). Card.ts's
  real `'Protection'` Keyword union member (added 2026-09-09) is always
  PERMANENT-scoped (`RealCard.keywords`/`continuousKeywordGrants`) — setting
  `keywords: ['Protection']` here would misrepresent the card as the
  CREATURE having protection (false unblockability implication). No
  player-level keyword-grant primitive exists in this engine at all, and
  this is the ONLY FIN card (checked, grepped full `fin_scryfall.json`) that
  would ever need one — not worth building narrow, inert machinery for a
  keyword nothing in `state.ts` enforces anyway (no chokepoint reads
  'Protection' for damage/targeting/enchant, same "recognized-but-inert"
  category Ward/Hexproof already are). Confirmed via `registry.ts`'s own
  `protection` coverage entry: still zero real `CardDefinition`s use the
  `'Protection'` Keyword literal pool-wide, unchanged by this task (didn't
  add it here either, for the reason above) — that registry gapNote
  ("Not even in card.ts's own Keyword union yet") is now STALE (the union
  member was added 2026-09-09) but out of scope to fix here (registry.ts
  belongs to the Keyword-coverage-page work, not this task).

**Real, actual fix made**: neither ability needed restructuring — added
real Forge-citation doc comments to both `staticAbilities` entries (the
file had ZERO comments before, unlike every other textual-escape-hatch
precedent in the pool, e.g. eject/stuck-in-summoners-sanctum, which all
cite the exact real Forge line + reasoning) explaining why each stays text
rather than a structured `Effect`/`Keyword`, plus a real byte-level typo
fix: the protection reminder-text string used a typographic curly
apostrophe (U+2019, "can’t") where real Scryfall oracle text (checked
byte-for-byte, `data/fin/fin_scryfall.json`) uses a plain ASCII apostrophe
throughout — now matches exactly.

**Verification**: `node functional-model/scripts/verify-synergy.mjs
absolute-virtue` → OK (unchanged, since `synergy.json`'s facts were never
derived from `staticAbilities` text and are untouched — this card's real
facts are all parser-derived cast/ETB/zone facts, unaffected by this
comment-only + one-character content change). `npx vitest run
functional-model` → 407/407 passed (pre-existing unrelated `tsc --noEmit`
errors in ~30 other cards, e.g. `.ts`-extension-import TS5097s, confirmed
NOT caused by this change — absolute-virtue doesn't appear in that error
list at all). `scenarios.ts` unchanged (its own `{ result: '...' }`
plus-`keywordScenarios(absoluteVirtue)` shape is a real, widely-used
(194 other cards) valid no-action scenario form for a card whose only
behavior is inert continuous/replacement text — not itself a defect).

**progress.json untouched, correctly**: `review` was already `"ai"` (never
elevated to human-`"reviewed"`), so the standing "authored-content change
resets review status" rule has nothing to reset here — it stays `"ai"`.
Did not bump `lastVerified` (2026-09-04) either — confirmed
`verify-synergy.mjs` never writes `progress.json` itself (read-only check
script), and nothing else in this pass established that field's actual
update owner/process, so left it alone rather than guessing.

**Open item, not done here**: `registry.ts`'s own `protection` coverage
entry's `gapNote` text is stale (says 'Protection' isn't in card.ts's
Keyword union — it has been since 2026-09-09) — a real, pre-existing
inaccuracy on the Keywords coverage page, unrelated to this task's scope,
surfaced as a byproduct of this audit.

## Third recognizer prototype: `Effect[]`-structural source (2026-09-13)

Bounded try, option (A) only (per explicit task scope — NOT (B), the bigger
"make synergy.json mostly generated" pivot): a third recognizer reading a
`CardDefinition`'s own already-typed `Effect[]` directly, not oracle text,
not Forge script. Full writeup lives in `functional-model/
PRD_AUTOMATED_AUTHORING.md`'s own new "Third recognizer prototype" section
(2026-09-13) — this is the short pointer, not a duplicate.

- Code: `functional-model/recognizers/destroy-effect-structural.ts` (+ its
  own `.test.ts`), same one-file-per-recognizer/provenance-tagging
  convention as Recognizers A/B. NOT wired into `apply-recognizers.mjs` —
  prototype only, same as A/B were before their own later wiring pass.
- Handles `kind:'destroy'` only. Reads `validType`/`nonLand`/`minPower`/
  `qty`/`optional` off the Effect, builds the pool's real `event:'destroy'`
  bare-ACT-tag Fact shape (SYNERGY_DESIGN.md's own "ACT vs CONSEQUENCE"
  standing rule — no `zoneFrom`/`zoneTo` on this fact, ever).
- **Annotation-anchoring solved for this case**: builds the expected literal
  English removal-clause FROM the structured fields (Magic's own removal
  templating is small/closed), then requires that exact phrase appear
  verbatim, exactly once, immediately followed by a real clause boundary, in
  the face's own real oracle text. This is meaningfully more reliable than
  the rejected Forge-script prototype's own annotation-remapping step
  (PRD's "Forge-script source tried and rejected" section) — the anchor
  phrase is generated from the SAME fields the Fact is built from, not
  reverse-engineered from an independently-shaped external DSL that can
  drift in word/field order. Real payoff, not just theoretical: `qutrub-
  forayer`'s own genuine "creature THAT WAS DEALT DAMAGE THIS TURN." trailing
  qualifier correctly fails the boundary check and declines, rather than
  truncating the annotation and asserting a broader claim than the card
  makes.
- Tested against the FULL real pool of `kind:'destroy'` effects (11 cards,
  confirmed via `grep -rl` — not cherry-picked): 7 accept (`summon-bahamut`
  — 2 chapter effects dedup to 1 fact, `fate-of-the-sun-cryst`, `battle-menu`
  — inside a `modal` mode with a real `minPower` threshold, `lunatic-
  pandora` — an activated-ability destroy, `sephiroth-s-intervention`,
  `sidequest-hunt-the-mark` — genuinely NEW fact, its own real `synergy.json`
  has none today, Dion's back face — unrestricted, correctly omits `target`
  entirely matching real hand data), 4 decline (`qutrub-forayer` — the
  boundary case above, `deadly-embrace`/`ultima-weapon`/`summon-primal-odin`
  — all `owner:'opponents'`, no confirmed real precedent for how THAT
  combines with a bare destroy-ACT tag, so declined rather than guessed).
- **Real side-finding, same shape as the earlier whole-pool wiring's
  "~200 cards missing cast/ETB" finding**: the `event:'destroy'` ACT fact is
  missing from hand-authored `synergy.json` on 7 of these same 11 cards
  today (not just the 4 declined ones) — a real, pre-existing pool gap this
  prototype surfaced, not fixed (not wired to the real pool).
- **Verdict, asked for explicitly**: yes, continuing option (A) to more
  `Effect` kinds is worth it — meaningfully easier/more reliable than the
  Forge-script attempt, for a structural reason (own-source, closed
  vocabulary, no second-catalog drift risk), not just luck on this one
  case. Real, non-trivial scope still had to be declined conservatively
  (owner-restricted, non-literal `qty`, `qty>1` — no real card yet to verify
  against), so still not literally free, but a real, principled narrowing,
  not silent guessing.
- Small aside, not fixed: `card.ts`'s own `destroy` Effect doc comment has a
  stale line ("no separate `optional` field here" directly above the real
  `optional?: boolean` field it defines) — flagged for whoever next touches
  that comment.
- Verification: `npx vitest run functional-model` 419/419 pass; `tsc
  --noEmit` +1 over baseline, and that +1 is the exact same already-accepted
  `load-fin-cards.mjs` TS7016 pattern `recognizers.test.ts` already has, not
  a new class of error.
- **Not done / still open**: wiring into `apply-recognizers.mjs`, any other
  `Effect` kind, the owner-restricted Fact-shape question (needs a real
  card + human call, not this prototype's to decide), Forge-verification of
  this recognizer's own removal-templating assumptions specifically (same
  "trained knowledge, not yet checked against a rules-text mirror" caveat
  the first two recognizers' own prototype already flagged and still
  hasn't been closed).

## `destroy-effect-structural` wired into real pool (2026-09-13, follow-up)

- Added to `apply-recognizers.mjs`'s `RECOGNIZERS` list. Its
  `StructuralRecognizerInput` needed `effects`/`triggers`/`abilities` on the
  per-face input object — the script's existing loop only ever built
  `{name, typeLine, oracleText}` (all Recognizers A/B needed); extended both
  the front/back `faces` construction and the per-recognizer `input` object
  to also carry those three fields straight off the already-imported
  `CardDefinition`/`.backFace` (no new data source, they were already
  in-memory, just not threaded through).
- Real whole-pool run reproduces the prototype's own 7-accept/4-decline
  split exactly (re-verified independently via a scratch script using the
  SAME real oracle-text loader `apply-recognizers.mjs` itself uses, not the
  test file's fixture loader) — no divergence.
- **Real, important nuance found while wiring**: recognizer ACCEPT is not
  the same as a NEW fact getting written. `apply-recognizers.mjs`'s own
  pre-existing `coreKey` dedup (deliberately excludes `value`) means 4 of
  the 7 accepted cards (`summon-bahamut`, `fate-of-the-sun-cryst`,
  `battle-menu`, Dion's back face) already had an exactly-equivalent
  hand-authored `event:'destroy'` fact (differing only in old `value: -1`
  placeholder vs. this recognizer's `1`) and get ZERO new facts/provenance
  from this pass. Only the 3 cards the prototype's own "real, useful
  side-finding" already flagged as genuinely missing the fact
  (`lunatic-pandora`, `sephiroth-s-intervention`,
  `sidequest-hunt-the-mark-yiazmat-ultimate-mark`) actually gained a new
  `provenance`-tagged fact. **`summon-bahamut` (fin/1) specifically — the
  user's own named motivating example — is UNCHANGED by this wiring pass**,
  still no `provenance` field on its destroy fact. Flagged explicitly to the
  orchestrator/user rather than silently accepted; documented in both
  `PRD_AUTOMATED_AUTHORING.md`'s new "Third recognizer wired into real
  per-card data" section and `.claude/contracts/card-schema.md`'s parser-fact
  section, since `card` needs to know not to expect a visible change on
  fin/1 from this pass.
- Verification: `npx vitest run functional-model` 419/419 pass; `npm run
  typecheck` — same 2 pre-existing baseline errors (`functional-model/
  mana.ts`, `server/api/tokens/by-key.ts`), both unrelated, 0 new (note:
  bare `npx tsc --noEmit` at repo root is a no-op here — `tsconfig.json` is
  project-references-only with `"files": []`; use `npm run typecheck` or
  `tsc --build tsconfig.json` for a real check); `verify-synergy.mjs` 0 hard
  failures pool-wide; `verify-annotation-coverage.mjs`/
  `verify-scenario-card-names.mjs` clean; `find-synergies.mjs` clean;
  re-running `apply-recognizers.mjs` a second time adds 0 new facts
  (idempotent, confirmed).
- **Open question surfaced, not decided**: whether the "already covered by
  an identical pre-existing hand-authored fact" case should ever
  retroactively backfill `provenance` onto that existing fact (vs. leaving
  it permanently unprovenanced, as today) — a real design question, out of
  this task's "additive only" scope to decide unilaterally.
- Still open, unchanged from before: Facts-tab toggle/provenance UI,
  per-card review-scope narrowing, "rule review" lane, Forge-verification
  of this recognizer's own removal-templating CR citations.

## 2026-09-13 — Dedup-match retagging closed (the "summon-bahamut shows zero
   visible change" gap fixed)

- **The open design question the previous entry left unresolved is now
  decided and implemented**: `apply-recognizers.mjs`'s dedup path (a
  recognizer's derived fact matching an existing hand-authored fact on
  `coreKey`) no longer silently skips. If the existing fact has no
  `provenance` yet, it's now RETAGGED IN PLACE — `provenance: {origin:
  'parser', rule, note}` added, every other field (`value`, `annotations`,
  `controller`) left byte-for-byte untouched (a recognizer confirms a
  fact's existence/shape, never its magnitude). Added `FactProvenance.note?:
  string` (`synergy.ts`) for this — a short documentary string, same "not
  consulted by matching logic" bucket as `provenance` itself. If the
  existing fact already HAS provenance (a prior run's own retag, or two
  recognizers/faces independently deriving the identical claim), it's
  counted as already-covered and left untouched — idempotent (verified by
  running the whole-pool pass twice in a row, second run retags 0).
- `existingKeys` (a bare `Set<string>`) became `existingByKey` (a
  `Map<string, Fact>`) so a dedup match can reach the real object reference
  to mutate — same array objects end up in `out.source`/`out.sink` at write
  time, so the mutation just rides along, no separate write path needed for
  a "retagged only, nothing newly appended" card.
- **Real whole-pool run**: 0 new parser-originated facts (pool already
  fully migrated from the prior 3-recognizer wiring passes), **163
  existing hand-authored facts retagged** —
  `permanent-enters-battlefield-normally`: 113,
  `instant-sorcery-resolves-to-graveyard`: 46, `destroy-effect-structural`:
  4. `summon-bahamut` (fin/1, the user's own motivating example) got 2 of
  those retags (its `entersBattlefield` fact via the ETB recognizer, its
  `destroy` fact via the structural recognizer) — its `destroy` fact's own
  `value: -1` placeholder is preserved exactly, not overwritten with the
  recognizer's own `1`.
- **Live-verified in the actual browser, not just JSON inspection**:
  `/app/card/fin/1` and `/app/card/fin/29` (Phoenix Down, a second retagged
  card) both show the retagged facts under the Facts tab's pre-existing
  "Show parser-derived facts" toggle (that toggle/popover UI was already
  built by `card` — this task found it working, didn't build it), each
  with a working hover popover ("Parser-derived — rule: `<rule>`" + real
  recognizer source).
- **Real bug found+fixed by that same live-verification step, one
  `card`-owned file, flagged as a lane-crossing but fixed directly since it
  was mechanical/non-semantic and blocking**: `server/api/recognizer-
  source/[rule].get.ts`'s hand-kept `RECOGNIZER_IDS` runtime array (mirrors
  the engine-owned `RecognizerId` type union by hand, per that file's own
  comment) had never been widened to include `'destroy-effect-structural'`
  even though `RecognizerId` itself already had it from that recognizer's
  own earlier wiring pass — every `destroy`-fact provenance popover 404'd
  ("Could not load recognizer source") until this one-line fix. `card`
  agent should know this file changed; nothing else about the route or its
  behavior changed.
- Docs updated to match (both flagged the prior "ZERO new facts on
  summon-bahamut"/"open design question" claims as historical, not current):
  `functional-model/PRD_AUTOMATED_AUTHORING.md`'s new "Dedup-match
  retagging closed" section, `.claude/contracts/card-schema.md`'s "Parser-
  derived facts" section.
- Verification: `npx vitest run functional-model` 419/419 pass; `npm run
  typecheck` — same 2 pre-existing baseline errors
  (`functional-model/mana.ts`, `server/api/tokens/by-key.ts`), 0 new;
  `verify-synergy.mjs` 0 hard failures pool-wide; `verify-annotation-
  coverage.mjs`/`verify-scenario-card-names.mjs` clean; `find-synergies.mjs`
  clean end-to-end; only `cards/<slug>/synergy.json` files changed
  pool-wide (no `definition.ts`/`progress.json` touched).
- **Not done, still open** (unchanged from before): per-card review-scope
  narrowing to exclude parser facts, the separate "rule review" lane for
  auditing the recognizer catalog itself, and the `FactProvenance.note`
  text is NOT surfaced anywhere in the UI beyond raw JSON/debug view (by
  design — documentary metadata, not required to be user-facing; flag to
  `card` if they ever want it rendered in the popover).

## 2026-09-13 — Fourth recognizer: `drawCard-effect-structural`

- Added `functional-model/recognizers/drawCard-effect-structural.ts`
  (mirrors `destroy-effect-structural.ts` exactly, reading `kind:'drawCard'`
  Effects instead of `kind:'destroy'`) + its own test file (23 cases, real
  pool cards only). Factored the shared container-walking logic
  (`collectEffects`/`allEffects`/`StructuralRecognizerInput`) out of
  `destroy-effect-structural.ts` into a new `structural-effects.ts` — both
  recognizers now import it; `destroy-effect-structural.ts` re-exports the
  type for backward compat with its own existing test import.
- `value` on a produced drawCard Fact is a FIXED `1`, never derived from the
  effect's own `amount` — confirmed against the real pool's existing
  hand-authored `event:'drawCard'` facts first (20 real cards, all read
  `value:1` regardless of actual draw count), same convention
  `destroy-effect-structural`'s own `value:1` established for `qty`.
- Real declines found (see PRD's own new section for the full list):
  non-literal (Computed) `amount`; a literal `amount` outside {1,2,3,4}; a
  literal `amount` that's an ENGINE-SIDE APPROXIMATION of a real variable
  draw the oracle text never states as a fixed number (Joshua Phoenix's
  Dominant, Kefka Court Mage, Combat Tutorial — all decline "for free" since
  the built clause just doesn't appear verbatim); "may draw" (Rook Turret —
  drawCard has no `optional` field, unlike destroy, so an optional draw is
  unrepresentable and would overclaim if asserted). Accepted boundary set is
  WIDER than destroy's own strict period/newline/end-of-string: comma and
  `" and "` are both real, pool-confirmed boundaries here (checked each
  "and"-clause corresponds to a real, separately-modeled second effect on
  the same card, never a hidden qualifier).
- **Real bug found+fixed in `apply-recognizers.mjs`'s own dedup/retag
  logic**, surfaced by `qiqirn-merchant` (2 genuinely different
  `event:'drawCard'` facts sharing one bare `coreKey`) — `existingByKey`
  widened from `Map<string,Fact>` to `Map<string,Fact[]>`. **Important
  correctness nuance, found via a real non-idempotent second-run diff, not
  assumed**: a naive "retag the first unprovenanced candidate per recognized
  instance" policy is WRONG when candidates.length > 1 — `matoya-archon-
  elder` has 2 existing drawCard facts sharing a coreKey that are NOT the
  same real claim (one real clause, one the card's own reminder-text
  parenthesis), and that naive policy incorrectly retagged the wrong one on
  a second run. Fixed: when >1 candidate shares a key, require an EXACT
  `annotations` match to disambiguate (falls back to the original
  single-candidate behavior otherwise). Manually reverted the one
  incorrectly-applied retag in `matoya-archon-elder/synergy.json` before
  landing the real fix. Re-verified idempotent (2 full pool runs, second
  adds/retags 0).
- `RecognizerId` (`recognizers/types.ts`) widened;
  `server/api/recognizer-source/[rule].get.ts`'s `RECOGNIZER_IDS` allowlist
  updated IN THE SAME PASS this time (not a follow-up fix) — confirmed via
  live browser hover on `/app/card/fin/1`'s "Card draw" row that the
  provenance popover's `GET /api/recognizer-source/drawCard-effect-
  structural` returns 200, not the 404 the previous recognizer's wiring
  pass shipped.
- Real whole-pool run: 20 new facts, 14 existing facts retagged
  (`drawCard-effect-structural`: 14). `summon-bahamut` (fin/1)'s own chapter
  III drawCard fact is now provenance-tagged, its real `value:4` untouched.
- Verification: `npx vitest run functional-model` 442/442 (was 419);
  `npm run typecheck` unchanged (2 pre-existing baseline errors, 0 new);
  `verify-synergy.mjs` 0 hard failures; `verify-annotation-coverage.mjs`/
  `verify-scenario-card-names.mjs` clean; `find-synergies.mjs` clean;
  live-verified in browser (Playwright script, not just curl) — Facts tab
  parser toggle, "Card draw" row, provenance hover popover all working.
- Full detail (all real declines, per-card reasoning, the two apply-
  recognizers.mjs bugs found+fixed) is in `PRD_AUTOMATED_AUTHORING.md`'s new
  "Fourth recognizer: drawCard-effect-structural" section and
  `.claude/contracts/card-schema.md`'s "Parser-derived facts" section — read
  those before touching this recognizer or the wiring script again.
- **Still open, unchanged from prior recognizer passes**: Facts-tab
  toggle/provenance UI already built (card-owned, no changes needed);
  per-card review-scope narrowing to exclude parser facts and the separate
  "rule review" lane are both still not designed/built; Forge-verification
  of this recognizer's own draw-card removal-templating assumptions (trained
  knowledge, not yet checked against a rules-text mirror — same open caveat
  every recognizer in this catalog still carries).

## 2026-09-13 — Fifth recognizer: `saga-lore-and-sacrifice-structural`

- Added `functional-model/recognizers/saga-lore-and-sacrifice-structural.ts`
  + its own test file (10 real-pool cases). Genuinely different input shape
  from Recognizers C/D (`Effect[]`-reading): reads a face's own `typeLine` +
  named `triggers` directly, mirroring `functional-model/saga.ts`'s own
  real, already-battle-tested `isSaga`/`maxChapterOf` derivation rather than
  re-deriving an oracle-text-pattern equivalent of the same question.
  Reuses `structural-effects.ts`'s `collectEffects` (not `allEffects` — this
  one needs to walk only ONE specific chapter trigger's own effects, not
  every trigger/ability/top-level effect on the face) to check the final
  chapter for any `kind:'custom'` effect.
- Two facts, different unconditionality: `putCounter`(LORE, self,
  `value:1`) is ALWAYS asserted once a face is confirmed a real Saga (no
  exceptions found in the real pool — matches the task's own claim);
  `sacrifice`+`dies` (self, `value:1` each) is asserted ONLY when the
  Saga's own final chapter's `effects` contain zero `kind:'custom'`
  entries — declined (lore-only) whenever it has any, since a `custom`
  closure's body (which might secretly transform the permanent back,
  resetting its lore counters and correctly voiding 714.4's sacrifice) is
  opaque to any static recognizer, same wall Recognizers C/D already name.
  This recognizer is deliberately NOT all-or-nothing per face (unlike C/D)
  — 1 fact (lore-only) or 3 facts (full triple) are both real, expected
  `matched:true` outcomes.
- **Real pool checked before writing any code**: 21 real Sagas (15 plain,
  6 transforming). `summon-g-f-cerberus` has a genuinely EMPTY
  `synergy.json` (no facts authored at all) — excluded from all counts by
  `apply-recognizers.mjs`'s own pre-existing `isV2Shaped` gate, a
  pre-existing gap unrelated to this task. Of the 20 remaining: **13 get
  the full triple** (`summon-anima`, `summon-bahamut`, `summon-choco-mog`,
  `summon-esper-ramuh`, `summon-fat-chocobo`, `summon-fenrir`, `summon-
  knights-of-round`, `summon-primal-garuda`, `summon-primal-odin`,
  `summon-shiva`, `summon-titan`, `esper-origins-summon-esper-maduin`,
  `jecht-reluctant-guardian-braska-s-final-aeon`), **7 get lore-only**
  (`summon-brynhildr`, `summon-g-f-ifrit`, `summon-leviathan`,
  `crystal-fragments-summon-alexander`, `dion-bahamut-s-dominant-bahamut-
  warden-of-light`, `joshua-phoenix-s-dominant-phoenix-warden-of-fire`,
  `jill-shiva-s-dominant-shiva-warden-of-ice`).
- **Real, checked-not-guessed correction to the task's own briefing**:
  `jecht-reluctant-guardian-braska-s-final-aeon` was flagged going in as
  "likely still uses a custom effect" — checked directly, its own chapter
  III is a plain `sacrifice` Effect, no `custom` at all (the `custom`
  effect is on the FRONT face's transform trigger, unrelated to chapter
  III). `saga.ts`'s own header independently confirms this card does NOT
  transform back. So this recognizer correctly ACCEPTS the full triple
  here — the initial guess was simply wrong, caught before it became an
  unnecessary decline.
- **Two real, deliberate divergences from existing hand-authored data**
  (same `zack-fair`/`permanent-enters-battlefield-normally.ts` precedent —
  a decline never removes/contradicts an already-authored fact):
  `summon-leviathan` and `crystal-fragments-summon-alexander` (back face)
  both already carry a hand-authored `sacrifice`+`dies` self-pair, but
  their own final chapters use `custom` for an unrelated reason (a
  type-filtered batch bounce; a tap-all-opponents-creatures effect —
  neither is a transform-back) — this recognizer declines the pair for
  both per the letter of its own rule, leaving those existing facts
  untouched/unprovenanced. A real, named, still-open blind spot: telling
  "custom for an unrelated reason" apart from "custom that also transforms
  back" needs real insight into a closure's own `run` body, out of reach
  for any recognizer in this family by construction.
- `value:1` fixed on both fact shapes (same convention destroy/drawCard
  established) — checked the real pool's existing `putCounter`/
  `sacrifice`/self-`dies` facts first: the modern convention is already
  `value:1` pool-wide; only `summon-bahamut`/`summon-knights-of-round`
  still carry legacy `-1` placeholders, correctly preserved by the dedup
  retag (never overwritten).
- Annotation anchors to the literal word "Saga" inside `typeLine` (not
  `type-line-span.ts`'s `typeWordsSpan`, which looks BEFORE the em dash at
  the card type — the Saga SUBTYPE word is after it) — a small new span
  helper in the recognizer file itself.
- `RecognizerId` (`recognizers/types.ts`) widened; `server/api/recognizer-
  source/[rule].get.ts`'s `RECOGNIZER_IDS` allowlist updated IN THE SAME
  PASS (not a follow-up) — confirmed via live browser: `/app/card/fin/1`'s
  "Counters"/"Sacrifice"/"Dies" rows' provenance popover returns 200 with
  real recognizer source (not the 404 the very first structural recognizer
  shipped); `/app/card/fin/58` (Jill, Shiva's Dominant // Shiva, Warden of
  Ice) back face correctly shows ONLY the "Counters" row provenance-tagged,
  no sacrifice/dies row at all — the lore-only, real transform-back
  outcome, live-confirmed not just JSON-inspected.
- Real whole-pool run (`apply-recognizers.mjs`, all 5 recognizers): 32 new
  facts, 14 existing facts retagged (`saga-lore-and-sacrifice-structural`:
  14) — `summon-bahamut` gets 3 of those (putCounter/sacrifice/dies, legacy
  `-1`/`-1`/`1` values preserved), `jill-shiva-s-dominant-shiva-warden-of-
  ice` gets 1 (its own existing back-face `putCounter`). Idempotent across
  3 consecutive runs (0 new/0 retag on runs 2 and 3). 20/21 real Sagas
  touched (`summon-g-f-cerberus` excluded, see above).
- **Pre-existing repo state found, NOT caused by this task**: the working
  tree already had ~275 dirty (uncommitted) `synergy.json` files at session
  start — this task's own whole-pool `apply-recognizers.mjs` run therefore
  also picked up and finished some of an EARLIER, never-committed session's
  own A-D recognizer retagging work on `summon-bahamut` specifically (its
  `cast`/`destroy`/`drawCard` facts' provenance retags, and one brand-new
  `entersBattlefield` fact from recognizer B that hadn't been added yet)
  mixed into the same `git diff HEAD`. None of that is this task's own
  code change (recognizer E's own diff is cleanly isolated to the 3
  `saga-lore-and-sacrifice-structural`-tagged retags/additions per card,
  confirmed against `git show HEAD:...` for both `summon-bahamut` and
  `jill-shiva-s-dominant-shiva-warden-of-ice`) — flagging so this doesn't
  read as scope creep: the repo's own dirty-tree state predates this
  session and is unrelated to recognizer E's own implementation.
- Verification: `npx vitest run functional-model` 452/452 (was 442); `npm
  run typecheck` unchanged (2 pre-existing baseline errors, 0 new);
  `verify-synergy.mjs` 0 hard failures; `verify-annotation-coverage.mjs`/
  `verify-scenario-card-names.mjs` clean; `find-synergies.mjs` clean.
- Docs updated: `PRD_AUTOMATED_AUTHORING.md`'s new "Fifth recognizer"
  section (full per-card breakdown), `.claude/contracts/card-schema.md`'s
  "Parser-derived facts" section (new bullet).
- **Still open, unchanged from prior recognizer passes**: Facts-tab
  toggle/provenance UI already built (no changes needed); per-card
  review-scope narrowing and the separate "rule review" lane both still
  not designed/built; this recognizer leans entirely on `saga.ts`'s own
  ALREADY-verified Forge/CR 714 citations rather than independently
  re-deriving them — no NEW Forge-verification was done or needed for this
  pass specifically, but the general "trained knowledge, not freshly
  re-checked against a rules-text mirror by this recognizer itself" caveat
  still applies to the "custom = opaque, can't see through it" reasoning
  the same way it does for Recognizers C/D. The `summon-leviathan`/
  `crystal-fragments-summon-alexander` "custom for an unrelated reason"
  blind spot (above) is a real, named, still-open limitation of this
  recognizer specifically, not closed by this pass.
- Also found and left alone as genuinely out of scope for this task: the
  pre-existing ~275-file dirty working tree itself (not this task's to
  clean up or commit — no commit was requested).

## 2026-09-13 — Gogo, Master of Mimicry / Quistis Trepe: definitions only

- Added `functional-model/cards/gogo-master-of-mimicry/definition.ts` and
  `functional-model/cards/quistis-trepe/definition.ts` — the only 2 FIN
  cards in the collector-number 1-150 range with no `definition.ts` before
  this pass (checked directly against `data/fin/fin_scryfall.json`, then
  re-verified after by slug-matching every 1-150 card name against
  `cards/*` — 0 remaining gaps). Deliberately NO `scenarios.ts`, no
  `synergy.json`/Facts, no `progress.json` entry — out of scope per task.
- Both cross-checked against real Forge scripts (`tmp/mtg-forge/forge-gui/
  res/cardsfolder/g/gogo_master_of_mimicry.txt`, `.../q/quistis_trepe.txt`)
  — oracle text matches `data/fin/fin_scryfall.json` exactly for both.
- **Gogo, Master of Mimicry** (`{2}{U}`, Legendary Creature — Wizard, 2/4):
  real COST (`activationCost: '{X}{X}, {T}'`) is genuinely payable —
  `Cost$ ... X X T` is exactly the "two `{X}` symbols sharing one chosen
  value" shape `mana.ts`'s `ParsedManaCost.xCount`/`resolveXCost` already
  handles (CR 107.3c, closed 2026-09-12) — verified directly via
  `activationCostFor`+`parseManaCost`+`resolveXCost`: `{X}{X}` parses to
  `xCount:2`, and `x=3` resolves to `generic:6` (2×3), not a guess. `Cost$
  XMin1` (X can't be 0) has no structured minimum-X field anywhere in this
  engine — left as real, undocumented-mechanically text only (same as
  Rydia's own single-`{X}` ability has no minimum either). The EFFECT
  itself ("copy target activated or triggered ability you control X
  times") is a real, checked, genuine gap: no stack-object/ability-copy
  mechanism exists anywhere (`ether/definition.ts`'s own doc comment
  already documents the identical wall for copying a SPELL on the stack;
  Gogo's is a third, even narrower case — an ability, not a permanent or a
  spell). Modeled as a single `kind:'custom'` no-op `effects` entry, same
  "described but not executed" convention `seifer-almasy`/`noctis-prince-
  of-lucis` already established for an unrepresentable clause.
- **Quistis Trepe** (`{2}{U}`, Legendary Creature — Human Wizard, 2/2): a
  real `on:'enter'` ETB trigger (structured, same convention `cloud-
  midgar-mercenary`/`dragoon-s-wyvern` use) wrapping a `kind:'custom'`
  no-op — precedent found and reused, not written from scratch:
  `seifer-almasy/definition.ts`'s own near-identical "Fire Cross" clause
  ("cast target instant or sorcery card ... from your graveyard without
  paying its mana cost") already documents the exact same real gap ("no
  Actions member anywhere can resolve/'cast' an arbitrary chosen
  CardDefinition"), and `noctis-prince-of-lucis`'s own "cast artifact
  spells from your graveyard" static permission independently confirms
  it's a repeated pool-wide gap, not a one-off. "Blue Magic" is a real
  ability word only (no `K:` line in the real Forge script) — not
  declared in `keywords`, same treatment "Landfall —"/"Fire Cross —" get
  elsewhere in the pool.
- Verification: both files import/evaluate cleanly (`vite-node`,
  confirmed real object shape incl. the `run` closures); `npx vitest run
  functional-model` still 452/452 (unchanged — nothing imports these 2
  files yet, expected since no scenarios were authored); `npm run
  typecheck` unchanged (same 2 pre-existing baseline errors — `mana.ts`
  line 255, `server/api/tokens/by-key.ts` — 0 new); ALSO ran `npx tsc -p
  functional-model/tsconfig.json` directly (the dedicated config that DOES
  include `cards/**/*.ts` unlike Nuxt's own app-scoped typecheck project)
  — neither new file appears anywhere in its error output (all listed
  errors are pre-existing, unrelated `.ts`-extension-import/`any`-type
  issues on OTHER, older card files). Confirmed via `git status --
  porcelain` that only the two `definition.ts` files are new — no
  `scenarios.ts`, `synergy.json`, or `progress.json` touched for either
  card.
- **Still open**: neither card has a `scenarios.ts`/Facts yet (explicitly
  out of scope for this pass) — a future pass authoring those will hit the
  same two real gaps documented above (no ability-copy resolution, no
  arbitrary-other-card cast resolution) and should keep both effects as
  documentary no-ops rather than trying to force either into a shape that
  doesn't fit, per this session's own findings.

## Recognizer decline taxonomy (`kind:'scope'|'mismatch'`) + hard-fail-on-mismatch (2026-09-13)

Full writeup in `functional-model/PRD_AUTOMATED_AUTHORING.md`'s own new
"`kind:'scope'` vs `kind:'mismatch'` declines, hard-fail-on-mismatch"
section — summary here for quick recall:

- `recognizers/types.ts`'s `RecognizerResult` now carries an optional
  `kind?: 'scope' | 'mismatch'` on `matched: false`. `'scope'` (implicit
  default, unchanged everywhere) = no structural basis to try at all.
  `'mismatch'` = a pattern WAS built from the card's own structured data but
  0/2+ verbatim matches were found in real oracle text — a real divergence,
  either a recognizer bug or a known approximation. Only
  `destroy-effect-structural`/`drawCard-effect-structural`'s own "built
  pattern, 0/2+ matches" decline paths set `kind:'mismatch'`; every other
  decline in those two files (and everything in
  `saga-lore-and-sacrifice-structural`, which never builds a text pattern
  at all) stays `'scope'`, untouched. Recognizers A/B untouched entirely.
- `rook-turret`'s "may draw" decline is deliberately `kind:'scope'` (an
  intentional designed-in guard — `kind:'drawCard'` has no `optional`
  field — not a real text/structure divergence), decided by judgment call,
  documented inline in both the recognizer file and the PRD.
- `apply-recognizers.mjs` collects every `kind:'mismatch'` across the WHOLE
  run (never aborts mid-run) and hard-fails (non-zero exit) at the end
  unless a `// recognizer-exception: <rule-id> — <reason>` marker exists
  anywhere in that card's own `definition.ts` (cheap extra `readFile` of
  the same path already resolved for the dynamic import). Markers landed on
  the 4 known real cases: `qutrub-forayer` (destroy), `combat-tutorial`,
  `joshua-phoenix-s-dominant-phoenix-warden-of-fire` (front face),
  `kefka-court-mage-kefka-ruler-of-ruin` (front face) — all drawCard.
- **Guard proven live**: temporarily removed the `qutrub-forayer` marker,
  re-ran against the 5 affected slugs — hard-failed (exit 1) with the exact
  card/rule/reason; restored the marker, re-ran clean (exit 0).

## Real bug fixed in the same pass: `coreKey` never normalized `subject` for self-referencing facts

Found during final live-verification of the above (folded in per
orchestrator instruction, not what the task started as). `coreKey`
(`apply-recognizers.mjs`) excluded `value`/`controller`/`annotations`/
`provenance`/`targeted` but never normalized `subject` — a legacy fact with
bare `target:'self'` (no `subject` key, predates the 2026-09-11 `synergy.ts`
merge) hashed differently than a recognizer-produced fact carrying
`subject:'self'` alongside it, so `permanent-enters-battlefield-normally`'s
own wiring appended a visible duplicate instead of retagging in place. 12
real pool cards affected (`summon-bahamut`/fin-1 was the most visible —
2 "Enters the battlefield" rows).

- Fix: `coreKey(fact, { normalizeSelfSubject = true })` — drops `subject`
  from the reduced key when `target==='self'` and `subject` is absent or
  already `'self'`; a non-default `subject` (e.g. `{token:...}`) still
  distinguishes.
- New `mergeDuplicateFacts` self-heals existing damage, `source`-array only
  (never `sink` — 79 pre-existing same-coreKey SINK groups in the pool are
  legitimately distinct, not this bug), gated on TWO conditions: (1) the
  group must be one the subject-fix itself created (checked via computing
  the pre-fix key too — a group that already collided pre-fix, e.g.
  `matoya-archon-elder`'s/`qiqirn-merchant`'s pre-existing bare-key
  ambiguity, is out of scope, owned by the main loop's own
  annotations-exact-match logic instead), (2) exactly one unprovenanced +
  1+ provenanced member (the confirmed real bug shape). A **real near-miss**
  was caught here: a first version without gate (1) wrongly merged
  `matoya-archon-elder`'s two genuinely-different `drawCard` facts (real
  clause vs. reminder-text parenthetical) — caught via before/after diff,
  reverted, gate (1) added specifically because of this.
- Verified: pool-wide same-face `entersBattlefield`/`cast` duplicate scan
  → 0 (was 12); `matoya-archon-elder` re-confirmed correct (3 real facts
  retagged, reminder-text fact untouched); 3 consecutive whole-pool runs
  (1st fixes, 2nd+3rd no-ops, idempotent); vitest 452/452; typecheck same 2
  pre-existing baseline errors; verify-synergy 0 hard failures;
  verify-annotation-coverage/verify-scenario-card-names clean;
  find-synergies clean end-to-end.

**Open Forge-verification note (unchanged, carried from prior passes)**:
none of this pass's work touched any new CR-rule citation — the existing
"trained-knowledge CR citations in each structural recognizer's own doc
comment not yet independently re-checked against a rules-text mirror"
caveat from the destroy/drawCard/saga recognizer passes is still open,
unaffected either way by this taxonomy/dedup-bug work.

## Real bug fixed: `permanent-enters-battlefield-normally` overclaimed on a transform DFC's own back face (2026-09-13)

CR 712/711: a transforming DFC's back face never gets independently cast
from hand or independently enters the battlefield — it only exists via
`transformPermanent`-ing an already-on-battlefield front face (`saga.ts`'s
own `transformPermanent` doc comment already respects this). The
recognizer had no way to know it was looking at a back face at all
(`RecognizerInput` only ever carried `typeLine`/`oracleText`), so it fired
identically on both faces of every transform DFC whose back face is
itself permanent-typed, wrongly asserting a self-cast+self-entersBattlefield
pair for a face that's never cast/entered that way.

- **Important correction to the task's own framing, confirmed by direct
  pool scan, not assumed**: `CardDefinition.backFace`'s doc comment
  ("A transforming DFC's back face") is NOT universally true in this
  codebase — `thranduil-sindarin-liege-silvan-rally`'s own module doc
  comment documents `backFace` being deliberately reused for a real
  Adventure-layout card too ("the REAL cast order/timing is reversed from
  a transform DFC ... adventure: spell side first, creature later from
  exile"), and 5 real FIN `layout:'adventure'` Town/Adventure pairs
  (`ishgard-the-holy-see-faith-grief`, `jidoor-aristocratic-capital-overture`,
  `lindblum-industrial-regency-mage-siege`, `midgar-city-of-mako-reactor-raid`,
  `zanarkand-ancient-metropolis-lasting-fayth`) are modeled the same way.
  So "has a `backFace` at all" is NOT by itself a safe universal
  "never independently cast" signal — it just happens to be safe for THIS
  ONE recognizer specifically, because every real non-transform use of
  `backFace` in the pool has a non-permanent-typed back face (`Sorcery`/
  `Instant — Adventure`), which this recognizer's own pre-existing
  `isPermanent` type gate already excludes regardless. No `modal_dfc`
  cards exist anywhere in the FIN pool (checked directly) — the "both
  faces independently castable AND both permanent" case this would
  actually break for doesn't exist yet.
- Fix, scoped narrowly (per orchestrator instruction — NOT a blanket
  "never touch backFace" for every recognizer): added
  `RecognizerInput.isBackFace?: boolean` (`recognizers/types.ts`, doc
  comment spells out the above non-universality explicitly so a future
  recognizer doesn't copy this flag's meaning wrong), set by
  `apply-recognizers.mjs`'s own per-face loop (`isBackFace: face.face ===
  'back'`) and by `recognizers.test.ts`'s own `faceOf` helper. Only
  `permanent-enters-battlefield-normally` reads it — every other
  recognizer ignores the field, same as they already ignore other
  unrelated fields on the shared input object.
- Cleaned the real pool: 26 real cards had the exact spurious shape (52
  facts total, 2 each) — every one confirmed to have NO `provenance.note`
  (i.e., a pure post-hoc recognizer append, never a retag of real
  hand-authored data) before deletion, same conservative discipline as
  every prior pass. Re-derived the affected-card list directly (cross-
  referencing `data/fin/fin_scryfall.json`'s real `layout` field +
  `card.backFace`'s own real `typeLine` for every card whose
  `definition.ts` actually DEFINES `backFace: {` — not just mentions the
  word in a comment, which over-matched by ~5 in a first naive grep pass)
  rather than trusting the task's own suggested list blind — it was close
  but not exact.
- Verified: 2 consecutive whole-pool `apply-recognizers.mjs` runs after
  the fix → 0 files written both times (byte-identical stdout), confirming
  idempotent and that the recognizer no longer re-adds this shape.
  Precise coreKey-based dup check (reusing `apply-recognizers.mjs`'s own
  `coreKey` reduction, grouped additionally by `face`, SOURCE-array only)
  → 0 hits for `cast`/`entersBattlefield` shapes pool-wide, specifically
  re-confirmed 0 on all 26 affected cards. (17 unrelated pre-existing
  same-coreKey groups DO still exist pool-wide for OTHER event shapes —
  flagged to the orchestrator as a separate, out-of-scope observation, not
  touched: most are legitimate distinct facts that only collapse because
  `coreKey` doesn't include `keyword`/`counterType`/`controller` — same
  known qiqirn-merchant/matoya-archon-elder-style ambiguity that script's
  own code already documents — but `jill-shiva-s-dominant-shiva-warden-of-
  ice` (2 byte-identical `grantKeyword` Unblockable facts, back face),
  `summon-leviathan` (2 byte-identical `drawCard` facts), and `summon-
  shiva` (2 byte-identical `tap` facts + 2 byte-identical `putCounter`
  facts) look like genuine accidental hand-authored duplicates worth a
  separate look — none carry `provenance`, so not this recognizer's doing).
  Live-verified via the real running dev server's actual `/api/card/fin/58`
  (Jill, Shiva's Dominant // Shiva, Warden of Ice) and `/api/card/fin/91`
  (Cecil, Dark Knight // Cecil, Redeemed Paladin, a non-Saga transform
  card) — same data path the Facts tab consumes: both cards' back faces
  now show 0 spurious cast/entersBattlefield-from-Hand facts, front faces
  fully untouched, Jill's own legitimate saga-recognizer
  entersBattlefield-from-Exile back-face fact (unrelated mechanic) still
  present and correct. **Caveat**: no actual browser/screenshot tool was
  available in this session to visually confirm the rendered Facts tab
  itself (only the underlying API response the page's data layer
  consumes) — functionally equivalent given `card` agent's page is a thin
  render of this same data, but a true pixel-level check is still open if
  ever needed. Full vitest suite (454/454 in `functional-model/`, whole-
  repo 526/531 — the 5 failures are pre-existing, unrelated
  `scripts/relations.test.mjs` failures from the separate historical-sets
  project's own missing `tagging/sets/arn/*` data files, not touched by
  this pass); `tsc -p functional-model/tsconfig.json` shows the same
  pre-existing baseline errors only (none in any file this pass touched
  except the pre-existing, unrelated `load-fin-cards.mjs` TS7016 import
  quirk already accepted elsewhere); `verify-synergy.mjs` 0 hard failures.

**Open Forge-verification note**: none — this fix cites CR 712/711
(transform DFC back face never independently cast/enters) and CR 714
(Saga, already-cited precedent), no new interfaces.ts mirror or Forge
signature involved.

## Duplicate-fact handling moved to a shared runner-level pass (2026-09-13)

- Moved duplicate-fact handling out of the 3 structural recognizers
  (`destroy-effect-structural.ts`/`drawCard-effect-structural.ts`/
  `saga-lore-and-sacrifice-structural.ts` — the third never actually had
  any bespoke dedup, confirmed directly) and into ONE shared pass in
  `apply-recognizers.mjs`, generalized per the user's own framing: "if we
  get 2 absolutely identical facts, group annotations and consider them 1
  fact." The two recognizers' own per-face `seen` Sets (keyed on full
  `JSON.stringify(fact)`, `annotations` included) are gone; both now just
  return every matched fact naturally, including literal duplicates.
- New shared function `mergeRecognizedFactsByIdentity` (in
  `apply-recognizers.mjs`) groups a face's own combined FRESH recognizer
  output by role + the SAME reduced `coreKey` the existing dedup-against-
  hand-authored pass already uses (deliberately reused, not a third
  identity notion — per the task's own explicit instruction), merging any
  group of 2+ into one fact whose `annotations` is the union (dedup'd) of
  every member's own. Runs BEFORE the existing `coreKey`/`existingByKey`
  retag loop (group-then-compare) — that loop's own logic (including the
  `matoya-archon-elder`-motivated "candidates.length > 1 needs exact
  annotation match" branch) is UNCHANGED, just now fed already-merged
  candidates.
- **Real wrinkle found empirically, not assumed**: literally following
  "only group fresh recognizer output, never touch existing on-disk
  facts" (the task's own stated constraint) produces ZERO pool-wide file
  changes on this already-processed pool — `qiqirn-merchant`'s own 2
  existing `drawCard` facts were BOTH already retagged
  `drawCard-effect-structural` in a PRIOR wiring pass (before this
  annotation-merging existed), so the fresh run's own newly-merged
  2-annotation incoming fact correctly fails the "exact annotations
  match" retag check against either single-annotation existing candidate,
  and is silently treated as "already covered." Confirmed via a real
  before/after snapshot diff of the whole pool (0 files changed on the
  first attempt). Since the task's own concrete, required verification
  (`qiqirn-merchant`'s live card page must show ONE merged fact) can't be
  reached under the literal single-pass reading, added a second, narrow
  existing-facts self-heal, `mergeSameRuleExistingFacts` — merges 2+
  EXISTING facts sharing a `coreKey` ONLY when every member already
  carries `provenance` AND all share the identical `rule` string (same
  discipline `mergeDuplicateFacts` already established for its own,
  differently-shaped bug — doesn't touch that function or `coreKey`/
  `existingByKey` itself, added alongside as a sibling pass). This
  correctly leaves `matoya-archon-elder`'s own real near-miss alone (its 2
  same-coreKey `drawCard` facts are NOT both provenanced — only the real
  clause is ever retagged, the reminder-text one never gets touched by
  any rule) while collapsing `qiqirn-merchant`'s pair. Flagging this
  explicitly since it goes slightly beyond the letter of "don't touch the
  existing dedup-against-hand-authored mechanism" — it's a NEW, additive,
  narrowly-gated pass, not a modification of `coreKey`/`existingByKey`/
  `mergeDuplicateFacts` themselves, and it's the only way the task's own
  stated required outcome is actually reachable given the pool's real
  current (already-retagged) state.
- Pool-wide re-run: exactly 1 file changed (`qiqirn-merchant/synergy.json`
  — its 2 `drawCard` facts merged into 1, `annotations` now a 2-entry
  array spanning both its `cantrip` and `bigDraw` abilities). 2 further
  consecutive runs: 0 files written, byte-identical hash — confirmed
  idempotent.
- Updated the 3 recognizer test files that asserted the OLD per-recognizer
  dedup behavior (`destroy-effect-structural.test.ts`'s Summon: Bahamut
  case; `drawCard-effect-structural.test.ts`'s Emet-Selch/Matoya/Jecht
  cases) — each recognizer now returns the literal duplicate pair instead
  of a deduped single fact; `qiqirn-merchant`'s own recognizer-level test
  is unchanged (that recognizer alone never merged these two, by design —
  merging is the runner's job now). All 5 recognizer test files pass
  (81/81); whole `functional-model/` suite 454/454; whole-repo `vitest
  run` 526/531 (the 5 failures are the same pre-existing, unrelated
  `scripts/relations.test.mjs`/historical-sets-sweep failures noted
  above, not touched by this pass); `tsc -p functional-model/tsconfig.json`
  shows the same pre-existing baseline noise only (confirmed via direct
  grep for my own touched files — only the pre-existing, unrelated
  `load-fin-cards.mjs` TS7016 import quirk, already accepted elsewhere);
  `verify-synergy.mjs` 0 hard failures (same pre-existing soft notes
  pool-wide, nothing new for qiqirn-merchant); `verify-annotation-
  coverage.mjs` clean.
- Live-verified via the real running dev server's `/api/card/fin/65`
  (Qiqirn Merchant's real collector number) — `functionalModel.synergy`
  now serves exactly ONE `drawCard` fact with a 2-entry `annotations`
  array (both real spans), not two separate facts.
- **`card`-side spot-check done (not fixed, per task scope)**:
  `FunctionalModelText.vue`'s own inline oracle-text highlighting already
  iterates a fact's FULL `annotations` array for both the `'oracle'` and
  `'typeLine'` branches — already correctly highlights both spans for a
  merged fact, no gap there. But the Facts-table row's own hover tooltip
  (`factSourceText`) and `factKey` (`app/pages/app/card/[set]/[number].vue`,
  ~lines 616/335) both only ever read `fact.annotations?.[0]` — for
  `qiqirn-merchant`'s merged fact this means the row tooltip only ever
  shows the `cantrip` ability's own line, never surfacing `bigDraw`'s own
  second span. Every fact before this pass had at most 1 real annotation,
  so this was never previously reachable; flagged in
  `.claude/contracts/card-schema.md` for `card` to pick up, not fixed here
  (out of scope).
- Documented all of the above in `.claude/contracts/card-schema.md`
  (new bullet under "Parser-derived facts").

**Open Forge-verification note**: none — this is a pure fact-bookkeeping/
dedup refactor, no rules-text/Forge-signature claim involved.

---

**2026-09-13: scenario-narrative "real"/"genuinely"/"actually" cleanup
sweep (pool-wide, purely textual).** User flagged `functional-model/
keywords/landfall/scenarios.ts`'s own `result` string as unreadable —
"real"/"genuinely" appeared 5x in one sentence, pure noise given the
long-standing "everything here is a real engine-piloted trace" policy
(not being questioned, just needed to stop being restated in every
narrative clause).
- Scope: the actual narrative STRING LITERALS that render as prose in
  ScenarioReplay UI — confirmed by reading `harness.ts`'s `Scenario`
  interface + `engine-trace.ts`'s `finishEnginePilotTrace` +
  `ScenarioReplayTrace.vue` (lines ~374-377, ~611): `result`, the `action`
  arg passed to `finishEnginePilotTrace` (NOT auto-derived for an
  engine-piloted trace, passed straight through), legacy `label`, and
  `pilot.beginStep(...)`/`advanceOneStep(pilot, label)` step labels (these
  populate `actions[].label`, rendered in the per-step action table, `act.
  label` in ScenarioReplayTrace.vue) — all in scope. `//` dev comments and
  `throw new Error(...)` messages (never rendered in the UI, dev-only
  assertions) — explicitly left untouched.
- First pass: literal `real engine playthrough:` action-string prefix was
  ~70 occurrences across 60 files — replaced with `engine playthrough:`
  everywhere via one scoped sed pass (mechanical, safe, no other text
  touched).
- Then swept both trees file-by-file: 12 `functional-model/keywords/*/
  scenarios.ts` + ~55 `functional-model/cards/*/scenarios.ts` needed
  hand-edits (case-INSENSITIVE grep matters here — capitalized `Real ...`
  sentence-starts don't match a lowercase-only `\breal\b` regex; missed
  ~15 `beginStep('Real ...')` labels on the first pass this way, caught
  on a second `\bReal\b|\bGenuinely\b|\bActually\b` sweep). Stripped
  `real`/`genuinely`/`actually`, and a few standalone `genuine` instances
  doing the same reassurance-filler job (e.g. "a genuine mutual kill" ->
  "a mutual kill" — the informative contrast ("not a one-sided effect")
  already carried the distinction). All rule cites, mechanism names
  (`pump`, `isLethallyDamaged`, etc.), and before/after values preserved
  verbatim.
- Regenerated ALL trace.json snapshots afterward (`vite-node functional-
  model/scripts/run-scenarios.mjs` for the 323 `cards/*/trace.json`,
  `run-keyword-scenarios.mjs` for the 12 `keywords/*/trace.json`) — these
  are pre-generated, not computed per-request, so leaving them stale would
  have shipped the old noisy text to the UI regardless of the scenarios.ts
  edit. Diff on regenerated trace.json also picked up some unrelated
  `id` field additions to `moveTo`/`pump` log entries — pre-existing
  engine.ts/state.ts drift already in the working tree before this task,
  not something this pass caused; worth the next engine session double-
  checking that field's own contract note is current.
- `npx vitest run functional-model`: 454/454 pass. `tsc --noEmit -p
  functional-model/tsconfig.json` shows only pre-existing baseline noise
  (import-extension/implicit-any errors in files this pass never touched —
  zero errors reference any edited `scenarios.ts`).
- Live-verified via Playwright (chromium already cached under
  `~/.cache/ms-playwright`, no reinstall needed) against a freshly
  restarted dev server: `/app/keywords/landfall` (the reported example),
  `/app/keywords/deathtouch`, `/app/keywords/saga-chapters`,
  `/app/keywords/flying-and-reach`, `/app/keywords/haste`,
  `/app/keywords/menace`, `/app/keywords/indestructible`, and two card
  pages' own Scenarios tabs (`/app/card/fin/6` Ambrosia Whiteheart,
  `/app/card/fin/13` Crystal Fragments, `/app/card/fin/264` The Masamune)
  — all render clean prose, zero information lost.
  - Gotcha for next time: `/app/keywords/<slug>` URLs are NOT the
    registry `key`/`bundle` field — `[[slug]].vue` resolves the route
    param against `slugifyKeywordTitle(entry.title)` (`app/lib/
    keywordSlug.ts`), and falls back to the FIRST sidebar entry on no
    match (no visible error). `/app/keywords/flying-reach` and
    `/app/keywords/saga` both silently rendered "Flying & Reach" (the
    first evergreen entry) instead of erroring — false-alarm "bug" during
    this verification, not a real one; correct slugs are
    `flying-and-reach` and `saga-chapters`.
  - Also: Playwright's `networkidle` wait hangs against this dev server
    (HMR websocket keeps the network non-idle) — use `domcontentloaded`
    + an explicit `waitForTimeout` instead for any future live-check here.

**Open Forge-verification note**: none — purely textual, zero rules-
citation or Forge-signature claims changed.

## Definition-level annotation prototype (2026-09-13, PRD_AUTOMATED_AUTHORING.md scoped trial, fin/1-10 only)

Bounded try at a DIFFERENT idea from that PRD's own recognizer-library
track: move annotation authorship out of oracle-text regex-matching and
onto `CardDefinition` itself, co-located with the trigger/ability it
describes, reusing `synergy.ts`'s existing `FactAnnotationAuthoring`
(`{anchor?, sourceText, highlight}`) shape verbatim so
`compute-annotations.mjs`'s existing resolution logic
(`computeFactAnnotations`/`rawHighlightRange`/`toLineOffset`) needs zero
changes to consume it. Deliberately additive/inert — NOT wired into
`apply-recognizers.mjs`, `synergy.json`, or any recognizer; purely a
authoring-ergonomics trial, not a cutover.

- **New type surface, `card.ts`**: `Trigger.annotation?`,
  `CardDefinition.abilities[].annotation?` (both `FactAnnotationAuthoring`),
  and a new top-level `CardDefinition.effectsAnnotation?`
  (`FactAnnotationAuthoring`) covering the top-level `effects` array (an
  Instant/Sorcery's cast effect OR a single activated ability's effect when
  paired with `activationCost` — named `effectsAnnotation`, not bare
  `annotation`, specifically to avoid reading as "annotates the whole
  card" at that top level). `card.ts` now has a type-only circular import
  of `FactAnnotationAuthoring` from `synergy.ts` (synergy.ts already
  imports `CardDefinition` the other way) — confirmed safe, erased before
  emit, 0 new typecheck errors.
- **Deliberately coarse per explicit user sign-off**: one annotation per
  container, covering the WHOLE printed trigger/ability line
  (cause+effect together), not per-`Effect` precision.
- **All 10 real fin/1-10 cards populated**: `summon-bahamut` (4 triggers,
  chapterI/II share one real annotation since Scryfall templates repeated
  Saga chapters as one shared "I, II — ..." line), `aerith-gainsborough`
  (2 triggers), `aerith-rescue-mission`/`battle-menu` (top-level
  `effectsAnnotation`, modal), `ambrosia-whiteheart` (2 triggers),
  `ashe-princess-of-dalmasca` (1 trigger), `auron-s-inspiration` (top-level
  `effectsAnnotation`), `cloud-midgar-mercenary` (1 trigger).
