# PRD — Templated card-fact auto-extraction (parser overlay)

Status: draft, revised 2026-09-13 after discussion with the user. **This
revision supersedes the original all-or-nothing framing** (a strict-function
library had to cover 100% of a card's text before anything was trusted, with
trace-verified scenario generation as a hard prerequisite gate) with an
overlay model: parser-derived facts and agent-authored facts coexist on the
same card, clearly separated by provenance but identical in shape. Unrelated
to the `docs/prds/` deck-builder/UI rework set — engine/functional-model
domain, its own initiative.

## Problem

Functional-model per-card scripts (the `CardDefinition`s that produce Facts
for synergy matching) are authored one at a time, by an agent exercising
judgment, reading Forge as ground truth for the card's real mechanical
shape. A large share of the *individual facts* within those definitions are
near-identical boilerplate across many cards — an instant or sorcery
resolving and going to its owner's graveyard, a permanent entering the
battlefield when cast — even on cards that are otherwise genuinely bespoke.
Authoring (and reviewing) that boilerplate by hand, on every card, every
time, is redundant effort that doesn't need human judgment at all.

## Goals

- A library of narrow, strict recognizer functions, each matching one
  specific, well-understood boilerplate pattern (e.g. "instant/sorcery
  resolves and moves to graveyard," "permanent enters the battlefield when
  cast") and producing the corresponding Fact(s), plus the text span it
  claims.
- **The agent still authors the `CardDefinition` from Forge, as today** —
  the parser is a narrow assist operating on specific facts *within* that
  process, never an independent oracle-text-only pipeline replacing it.
- Apply the parser first; whatever it doesn't recognize is the agent's job,
  same as today. Concretely:
  - **Partial or no coverage** → agent is engaged normally, authoring
    whatever facts remain — today's existing process, unchanged.
  - **Full (100%) coverage** → agent is *still* engaged, but in a
    scrutinizing/verification posture rather than authorship: full coverage
    is the case that most needs attention, not least, precisely because
    there's no organic remainder prompting a natural double-check. Never
    silently skip agent involvement entirely.
- Parser-derived facts get real text-offset annotations as a natural
  byproduct of the matching itself — the strict function already knows
  which span it claimed, so recording that as the annotation is close to
  free, unlike today's manually-authored annotations.
- Parser-derived facts are tracked with **separate provenance** from
  agent-authored facts, but use the **exact same Fact format/shape** —
  provenance is metadata about a fact, not a fork of the fact vocabulary
  itself.
- **Human review scope narrows to agent-authored facts only.**
  Parser-derived facts never enter the per-card human-review queue.
- **A separate review lane for the parser itself**: review/audit the
  finite catalog of extraction rules directly, rather than sampling
  individual card instances (explicit user preference — reviewing "exact
  rules of conversion" is a better use of attention than card-by-card
  spot-checks). When a rule is found wrong or gets extended, fix it once
  and re-run it against every affected card — no per-card re-review
  needed, since these facts were never a human review event to begin
  with.
- **Retroactive correction is an accepted, expected safety valve, not a
  failure mode.** An individual card whose parser-derived fact turns out
  wrong for that specific card (e.g. "exile this instead of putting it
  into a graveyard") gets fixed when found — not prevented upfront via
  exhaustive rule engineering against every MTG exception. Consistent with
  this, the agent authoring a card's remaining facts should eventually have
  visibility into which facts the parser already applied, and an ability
  to override/replace one for that specific card — **not built now**,
  deferred until an actual need surfaces (see Non-goals).

## Non-goals

- **Building the per-card parser-fact override mechanism now.** Noted as a
  plausible future need, not required for the initial version.
- **A hard, blocking trace-verification gate before a parser fact can be
  trusted or hidden from review.** The original draft of this PRD required
  full-text-coverage AND execution-trace verification before anything
  could be marked trusted — that requirement is superseded. The accepted
  safety net now is agent scrutiny on full-coverage cards plus retroactive
  fixing when a specific card's boilerplate assumption turns out wrong,
  not an upfront proof for every fact before it's allowed to exist
  unreviewed. (The engine's existing `verify-synergy.mjs` reconciliation
  doesn't go away — it still runs for whatever it already covers — this
  just isn't a new hard prerequisite this PRD adds.)
- **`kind: 'custom'` cards remain fully manual where the parser has
  nothing to say** — no ceiling changes here, this PRD just means the
  parser can now contribute *something* to nearly every card instead of
  only to the ones it can fully explain.
- **Scenario auto-generation** — the same overlay idea could plausibly
  extend to probe scenarios later ("yes... but mileage might vary"), but
  it's explicitly not required for standard card functioning and isn't
  part of this PRD's scope. Parked as a future idea.
- No changes to the theme/relation tagging pipeline
  (`data/fin/fin_relations.json` / `scripts/REVIEW_PROCESS.md`) — separate
  domain, unaffected by this.

## Design

Grounded in `engine` specialist research (2026-09-13, from the original
draft, still applicable):

- **Multi-recognizer conflicts — flagged, not yet built.** Not urgent
  today (the two prototype recognizers are type-disjoint: instant/sorcery
  vs. permanent, never both fire on one card), but the library will grow.
  Two failure modes to guard once it does: two recognizers claiming
  overlapping text spans, or two recognizers asserting contradictory
  facts. Both should hard-fail loudly, never silently pick a winner —
  consistent with the existing conservative-by-construction principle.
  No precedence/ranking system yet — premature without a real conflict to
  design against (same "try it, see what happens" reasoning as the
  organizational question this PRD already deferred).
- **No prior per-fact provenance tracking exists.** Today's only status
  tracking, `functional-model/cards/<slug>/progress.json`, is per-*card*
  (`enrichment`/`review`), not per-fact. This PRD needs a finer-grained
  mechanism.
- **Correction (2026-09-13, after real wiring landed): `AnnotationRef` is
  itself a field ON `Fact`** (`Fact.annotations`), not a side-channel file
  — the premise in this bullet's original wording was wrong. Only the
  precomputation *authoring input* (`annotations-authoring.json`) is a
  separate file, which doesn't apply here since a recognizer knows its own
  provenance at generation time, nothing to precompute from. The real
  invariant that actually mattered — provenance is documentary-only,
  never consulted by `factsInteract`/`themeOf` matching, never forking the
  Fact vocabulary the engine simulates against — holds regardless. Landed
  as `Fact.provenance?: { origin: 'parser'; rule: string }`, a plain
  optional field directly on `Fact`, in the same "documentary, not
  consulted" bucket as `targeted`/`untilEndOfTurn`. See "Wired into real
  per-card data" below for the actual implementation.
- **Strict functions stay conservative by construction** — a false
  negative (falls through to agent authorship) is fine and expected; a
  false positive (wrongly claims a span it doesn't fully understand) is
  still not acceptable. Retroactive correction is the safety net for the
  rare miss that gets through anyway, not a license to be careless
  upfront.
- **Facts tab**: a show/hide toggle for parser-derived facts — not
  permanently invisible (that would undercut the existing "Facts tab is
  always one complete, text-ordered list" convention), not always-on
  clutter either. When shown, a parser fact displays its provenance detail
  (which rule, matched span) per the user's "detailing" ask.
- **New "rule review" lane**, distinct from `scripts/REVIEW_PROCESS.md`'s
  per-card loop: reviewing the finite catalog of parser rules themselves.
  Likely needs its own lightweight runbook once the library exists
  (mirroring how `REVIEW_PROCESS.md` documents the per-card loop) — not
  written yet, a natural follow-up once there's something to document.
- **Re-run capability**: since parser facts are pure function output over
  oracle text, fixing or extending a rule can be mechanically re-applied
  across the whole affected corpus without re-review — this is the
  concrete payoff of keeping provenance separate in the first place.

## Open questions (flag, don't guess)

- Exact per-fact provenance schema/file shape — `engine`'s call at
  implementation time, per Design above.
- Whether `progress.json`'s `review` field needs any semantic change given
  review scope now excludes parser facts, or whether it stays as-is (it
  already only ever meant "the judgment-call parts are confirmed," never
  "literally every fact was eyeballed" — mirrors the existing
  mechanical-prefill precedent on the theme-tagging side). Likely no
  change needed, worth a quick confirmation with `engine` rather than
  assuming.
- Exact rule-review UI/workflow shape — not designed yet.
- When (if ever) the per-card override mechanism actually becomes worth
  building — deferred, not decided now.

## Acceptance criteria

- Done when a strict-function library extracts at least a first
  meaningful set of narrow, well-understood boilerplate facts (e.g.
  instant/sorcery resolve→graveyard, permanent enters-battlefield-when-
  cast) from real corpus cards, applied *alongside* agent-authored facts
  on the same card — not gated on covering the whole card.
- Done when parser-derived facts carry real text-offset annotations
  produced as a byproduct of the matching itself, not authored separately.
- Done when parser-derived facts are excluded from the per-card
  human-review queue, verified against a real card.
- Done when the Facts tab has a working show/hide toggle for
  parser-derived facts, and toggling it on displays enough provenance
  detail to see which rule produced each one.
- Done when a full-coverage card (100% parser-matched) still receives an
  agent verification/scrutiny pass rather than being silently marked done
  with zero agent involvement.
- Done when a demonstrated rule fix or extension can be re-applied across
  every previously-parsed card without requiring per-card re-review.

## Prototype findings (2026-09-13, bounded first try)

Two real recognizers built and verified against real FIN cards (not the
full library — a deliberately small experiment to learn organizational
shape before designing it in the abstract): "instant/sorcery resolves to
graveyard normally" and "permanent enters the battlefield normally." Code
at `functional-model/recognizers/`. 25 tests, all passing, against real
accept- and decline-cases.

- **Organization: one file per recognizer, not grouped by pattern-type.**
  Each recognizer's ground-truthing narrative (which real cards were
  checked, which false-positive trap was found and how) turned out
  substantial and card-specific enough that a shared file would dilute it.
  Shared span/text helpers go in their own small imported modules, not
  copy-pasted per recognizer.
- **Contract**: pure, synchronous, zero live-engine/board-state access —
  `(RecognizerInput) => RecognizerResult`. Neither prototype recognizer
  needed anything beyond the card's own printed text/type line.
- **Annotation-as-byproduct confirmed working as designed**: each
  recognizer computes its own match offset and builds the real
  `AnnotationRef` directly from it — no separate authoring step, no
  `annotations-authoring.json` indirection at all for parser facts.
- **The real lesson**: both false-positive traps found during this
  prototype (wrongly declining every Saga, wrongly declining every
  Flashback card) were only caught by testing *accept*-cases that
  superficially resemble decline-cases — not by testing decline-cases
  alone. A new recognizer should always be checked against at least one
  real card it should accept that looks like it might not, not just
  against cards it should correctly refuse.
- **Two real data-quality side-findings**, unresolved, worth a look
  separately: `Zack Fair`'s existing hand-authored data keeps baseline
  facts despite a genuine CR 614.12 replacement effect the recognizer
  correctly declines under — a documented, harmless-under-this-model
  divergence, but exactly the kind of case the planned "rule review lane"
  should surface. `Ultima`'s existing hand-authored `synergy.json` still
  asserts a self-graveyard fact that looks wrong given its own "exile ...
  including this card" text — a likely-latent existing bug the recognizer
  surfaced, not fixed.
- **Not yet re-verified**: the CR-rule citations in the prototype's code
  comments are from trained knowledge, not checked against a rules-text
  mirror — worth confirming before this becomes the real pool-wide
  library.

## Flagged future direction, not yet attempted: black-box execution

A fourth possible fact source, raised 2026-09-13, deliberately not
dispatched as a prototype yet (staying focused on real per-card fixes
first): instead of parsing any source representation (oracle text, Forge
script, `definition.ts` structure), actually run a card through the
existing harness (cast it, or another probe scenario) and derive Facts
from the observed trace/state-diff — treating the `CardDefinition` as a
black box.

**Why this is a genuinely different angle, not a repeat**: every static
source tried so far (oracle text, Forge script, `Effect` structure) hits
the same wall at `kind:'custom'` (~30% of effects, per `engine`'s
architecture research) — an opaque closure with nothing to statically
read. Black-box execution doesn't care how an effect is implemented, only
what it observably does when run — it's the one approach that could
actually cover `custom`-kind cases too.

**Real limitation, not solved by the idea alone**: a single "just cast it"
scenario only surfaces immediate/passive facts (enters-battlefield,
resolves-and-goes-to-graveyard) — the same two things the oracle-text
recognizers already cover, incidentally. Anything conditional (a
dies-trigger, an attack-trigger) needs a probe scenario specifically built
to hit that condition, which is the same coverage problem
`keyword-scenarios.ts` already solves for *verification* — this would need
the equivalent for *generation*. Not a free win, just a different kind of
work than text/structure parsing.

## Forge-script source tried and rejected (2026-09-13)

A second recognizer input source was prototyped: reading Forge's own card
script (structured `Key$ value` DSL) instead of oracle text, motivated by
compound effects that are hard to regex out of English (token creation:
"1/2 white Moogle creature token with lifelink" as one item). Prototype
code at `functional-model/recognizers/*.prototype.ts` (not wired into
anything real, kept for reference). **Verdict: not worth pursuing further
in this form.**

- Structured extraction itself worked trivially for the motivating case
  (Moogles' Valor) — Forge's own script already has the token's
  count/P-T/color/type/keywords as clean fields.
- But annotation-remapping (mapping the Forge-script extraction back onto
  the card's own oracle text, needed so the fact still anchors to real
  text) was genuinely **not free** — needed real Magic-templating
  knowledge (quote-aware clause bounding, word-order/word-presence
  variance between a card's prose and its script's field order) on top of
  the structured read.
- Worse: a **real second-source-of-truth drift problem**, structurally
  impossible for oracle-text-only recognizers — two real catalog-id
  mismatches surfaced between Forge's token ids and this app's own
  `tokens.ts` (one card's Forge token id doesn't exist in `tokens.ts` at
  all; that card's own existing `synergy.json` already asserts an
  unresolvable token reference today, an existing latent bug, not
  introduced by this prototype).
- **Recommendation, accepted**: don't pursue Forge-script recognition
  further. Deriving facts from this app's own already-typed
  `definition.ts` structures instead avoids both problems — a
  `createToken` effect already references a real `TOKENS` entry directly
  (compile-time-checked, can't drift), and the annotation problem becomes
  "map structured data back onto this card's own oracle text," solvable
  once per `Effect` kind rather than per external DSL. Next expansion of
  the recognizer approach should go there, not toward Forge scripts.

## Wired into real per-card data (2026-09-13, follow-up to the prototype)

The prototype's own explicit non-goal ("this prototype does NOT write
recognizer output into any real `cards/<slug>/synergy.json`... real future
work, not attempted here") is now done. New `functional-model/scripts/
apply-recognizers.mjs` — additive, mechanical, idempotent — runs both real
recognizers against every real pool card's own printed text (front AND
back face, real `data/fin/fin_scryfall.json` oracle text + the already-
imported `CardDefinition`'s own `typeLine`), and appends any genuinely NEW
matched fact (one not already covered by an existing fact, compared on a
reduced "core identity" key excluding `value`/`controller`/`annotations`/
`provenance` — see that script's own header for why those three specific
fields had to be excluded, a real pool inconsistency this task found, not
a guess) to that card's own `source` array, tagged
`provenance: {origin:'parser', rule: <RecognizerId>}` (`synergy.ts`'s new
`Fact.provenance` field — see `.claude/contracts/card-schema.md`'s own new
section for the full served-shape writeup, since `card` builds directly
against that).

- **Real, whole-pool run, not a cherry-picked sample**: 202 of 323 real
  pool cards gained at least one new parser-derived fact (435 facts total).
  20 real cards have no real oracle text available at all (cross-set
  reference cards — Breeding Pool, Cavern of Souls, Craterhoof Behemoth,
  Elrond/Thranduil/Tyvar, Llanowar Elves, etc. — real Magic cards this pool
  references for combos/tokens but outside the checked-in FIN corpus, no
  `data/<set>/` entry to read from); 3 cards are still old (v1) shaped and
  were skipped, same tolerance every other script in this pipeline already
  has for an unmigrated card.
- **The two side-finding cards, re-confirmed for real, not just in the
  prototype's own tests**: `zack-fair` and `ultima` both come out of this
  whole-pool run with **zero new facts and zero diff** — both recognizers
  decline them for exactly the reasons this PRD's own "Prototype findings"
  section already documented, and this wiring pass did not touch either
  card's existing hand-authored data (including Ultima's own arguably-wrong
  self-graveyard fact — still not fixed, still just surfaced).
- **A real, useful side effect surfaced along the way, not just risk**:
  ~200 cards turned out to be missing this exact boilerplate pair
  entirely — not "already covered, so no-op" as the prototype's own
  spot-checked sample suggested, but genuinely never authored (e.g. `A
  Realm Reborn`, a plain Enchantment whose own hand-authored `synergy.json`
  had only its own static-ability fact, no baseline self-cast/self-enters
  pair at all). This is the PRD's own stated goal working as intended: the
  parser filling in real, currently-missing boilerplate an agent hadn't
  gotten to yet, not just re-confirming already-authored facts.
- **One real, principled `scripts/verify-synergy.mjs` change accompanied
  this**: a parser-derived fact with no supporting execution-trace evidence
  is now a soft note, not a hard failure (see that script's own inline
  comments and `.claude/contracts/card-schema.md`'s new section) — this
  wiring surfaced 43 real cards whose own `scenarios.ts` never actually
  casts them from hand (they only exercise the card's own distinguishing
  ability), which would otherwise have hard-failed the pool-wide check for
  a boilerplate claim that's true by construction, not for any actual
  parser mistake. Confirmed against a real before/after: 0 hard failures
  both before AND after this whole task (43 would-be new hard failures,
  all downgraded to visible notes, all on cards this task's own wiring
  touched — verified via `git stash` isolation, not assumed).
- **Full verification, this session**: `npx vitest run functional-model`
  398/398 pass (unchanged); `tsc --noEmit` 49 errors (unchanged baseline,
  all pre-existing); `verify-synergy.mjs` 0 hard failures pool-wide;
  `verify-annotation-coverage.mjs`/`verify-scenario-card-names.mjs` both
  clean; `find-synergies.mjs` runs clean end-to-end (new cross-card
  matches now appear for cards that previously had no self-cast/self-enters
  pair to match against at all, e.g. A Realm Reborn now correctly shows up
  as a real "enters the battlefield" producer).
- **Not done in this pass** (still real, open follow-ups, not attempted
  here): the Facts-tab show/hide toggle + provenance-detail UI, narrowing
  per-card human review scope to exclude parser facts, the separate
  "rule review" lane for the recognizer catalog itself, a per-card
  override mechanism, and building a THIRD recognizer (this pass only ever
  wired the two that already existed — growing the catalog itself is
  separate work). Re-verifying the CR-rule citations in each recognizer's
  own code comments against a real rules-text mirror (flagged, still
  unverified, in the prototype's own "Open Forge-verification note") is
  also still outstanding.

## Third recognizer prototype: structural (`Effect[]`) source, not text (2026-09-13)

Bounded try at the explicitly-flagged fork (A) from the Forge-script
rejection above ("Deriving facts from this app's own already-typed
`definition.ts` structures... Next expansion of the recognizer approach
should go there") — NOT fork (B) (making `synergy.json` mostly generated),
which stays out of scope. Code at `functional-model/recognizers/
destroy-effect-structural.ts` + its own test file, same one-file-per-
recognizer/provenance-tagging conventions as Recognizers A/B, NOT wired into
`apply-recognizers.mjs`/the real pool (prototype only, same bounded spirit
the first two recognizers started with before their own later wiring pass).

- **What it reads**: a face's own `CardDefinition.effects`/`triggers[].
  effects`/`abilities[].effects` (recursing into `modal` modes) directly —
  never oracle text, never Forge script — and derives the `event:'destroy'`
  Fact a `kind:'destroy'` Effect's own `validType`/`nonLand`/`minPower`/
  `qty`/`optional` fields imply, by direct analogy to the real hand-authored
  shape already established pool-wide (`fate-of-the-sun-cryst`, `battle-
  menu`, `summon-bahamut`'s own real `synergy.json` entries).
- **The annotation-anchoring problem, actually solved for this case, not
  just worked around**: an `Effect` has no text-span pointer, same real
  problem the rejected Forge-script prototype hit. But the fix here is
  meaningfully simpler and more reliable than that case needed, for a
  structural reason, not just luck: this recognizer BUILDS the expected
  literal English clause directly FROM the structured fields (Magic's own
  removal templating is a small, closed vocabulary — "[up to one] target
  [nonland] <creature|land|permanent>[ with power N or greater]"), then
  requires that exact phrase to appear VERBATIM, exactly once, immediately
  followed by a real clause boundary (a period, a newline, or end of
  string), in the face's own real oracle text — no independent second-DSL
  word-order/field-order guessing required, because the phrase itself is
  generated from the same small set of fields the Fact is built from, not
  reverse-engineered from a differently-shaped external source. The
  boundary check is what makes this genuinely safe rather than just
  optimistic: `qutrub-forayer`'s own real "Destroy target creature THAT WAS
  DEALT DAMAGE THIS TURN." correctly fails to match (no field anywhere in
  the structured `Effect` — or in this pool's own `Constraints` vocabulary
  at all — represents "dealt damage this turn," so the built phrase "target
  creature" is a real, true prefix but not followed by a boundary) — the
  recognizer declines instead of truncating the annotation and silently
  asserting a broader claim than the real card makes.
- **Tested against the FULL real pool of `kind:'destroy'` effects, not a
  cherry-picked sample**: all 11 real cards with a `kind:'destroy'` Effect
  anywhere in the pool (confirmed via `grep -rl "kind: 'destroy'" cards/`,
  zero elsewhere in `keywords/`/`token-cards/`) — 7 accepted, 4 declined,
  every one checked against real oracle text and (where one exists) real
  hand-authored `synergy.json` for consistency:
  - **Accepted**: `summon-bahamut` (chapterI + chapterII both point at the
    identical real clause — deduped by this recognizer itself to ONE fact,
    matching the real hand-authored file, which also has exactly one),
    `fate-of-the-sun-cryst`, `battle-menu` (inside a `modal` mode, with a
    real `minPower` threshold — "with power 4 or greater"), `lunatic-
    pandora` (an activated, sacrifice-cost `abilities[]` destroy, not a cast
    effect), `sephiroth-s-intervention`, `sidequest-hunt-the-mark` (a named
    trigger, optional qty:1 creature destroy), and Dion's back face
    (`Bahamut, Warden of Light` — unrestricted "Destroy target permanent,"
    correctly emits NO `target` key at all, matching real hand-authored
    data exactly).
  - **Declined**: `qutrub-forayer` (the trailing-qualifier case above),
    `deadly-embrace`/`ultima-weapon`/`summon-primal-odin` (all
    `owner:'opponents'` — see below).
- **Real, deliberate scope narrowing, not silently guessed**: `owner`
  (`EffectOwner`, "an opponent controls") declines unconditionally — no real
  hand-authored `destroy`-ACT fact in the pool combines `owner` with a bare
  `event:'destroy'` tag today to confirm the right shape against (a plausible
  guess by analogy to how this pool's own `dies`-CONSEQUENCE facts already
  encode it, `controller:'opp'`, for these same three cards — but genuinely
  unconfirmed for the ACT fact specifically, so this recognizer declines
  rather than assert it). Also declines a non-literal (`Computed<number>`
  function) `qty`/`minPower`, and any `qty !== 1` (no real qty>1 card in the
  pool to check plural templating against) — same "grow only when a real
  card forces it" discipline the rest of this pool's own conventions already
  use, not new caution invented for this file.
- **A real, useful side-finding, same shape as the earlier whole-pool
  wiring's "~200 cards missing cast/enters-battlefield" finding**: the
  `event:'destroy'` ACT fact is missing entirely from **7 of these same 11
  real cards' own hand-authored `synergy.json`** today — not just the 4
  this recognizer declines for a real reason, but also `sidequest-hunt`
  (this recognizer's own new fact would be a genuinely NEW addition, not a
  re-confirmation) and, notably, `qutrub-forayer` itself (declined by this
  recognizer for a real reason, but also simply never hand-authored either
  — the qualifying clause is a real gap in BOTH the manual and mechanical
  approaches, not resolved by this prototype). Worth a look by the planned
  "rule review" lane once/if this recognizer is ever wired for real.
- **Small, pre-existing doc-comment inconsistency found along the way, not
  fixed**: `card.ts`'s own `destroy` Effect doc comment (the one line above
  its `optional?: boolean` field) says "no separate `optional` field here"
  while the very next line defines exactly that field — stale wording, not
  a behavioral bug; flagged for whoever next touches that comment, not
  changed by this task.
- **Verdict on continuing option (A) to more `Effect` kinds: yes,
  meaningfully easier and more reliable than the Forge-script attempt**,
  and for a structural reason, not just this one lucky case: deriving from
  THIS APP'S OWN already-agent-verified `definition.ts` data means the
  annotation-anchor phrase is generated from the SAME fields the Fact
  itself is built from (one small, closed, testable vocabulary), rather
  than reverse-engineered from an independently-shaped external DSL whose
  own field order/word choice can drift from the card's prose — the exact
  problem that made the Forge-script prototype's annotation-remapping step
  genuinely not free. It also has none of that prototype's real second-
  source-of-truth drift risk (no external id catalog — like Forge's own
  token ids vs. this app's `tokens.ts` — for a structural read to
  desynchronize from). Not literally zero-cost, though: real MTG removal-
  templating knowledge still had to be encoded by hand (the quantifier/type-
  word/minPower-suffix vocabulary above), and a real, non-trivial share of
  cases (owner-restricted, non-literal `qty`, `qty>1`) still had to be
  conservatively declined for lack of a confirmed real precedent to build
  against — narrower, well-scoped honesty, not full coverage. Verification:
  `npx vitest run functional-model` 419/419 pass; `tsc --noEmit` +1 new
  error over baseline (a `TS7016` on this recognizer's own test file's
  `load-fin-cards.mjs` import — the exact same already-accepted pattern
  `recognizers.test.ts` uses for the same import, not a new class of issue).

## Third recognizer wired into real per-card data (2026-09-13, follow-up to the prototype)

`destroy-effect-structural` is now wired into `functional-model/scripts/
apply-recognizers.mjs` alongside the first two recognizers — same additive/
idempotent treatment, no new script, no separate pipeline.

- **Loading fix needed and made**: `apply-recognizers.mjs`'s existing per-face
  input object only ever carried `name`/`typeLine`/`oracleText` (all Recognizers
  A/B ever needed). This recognizer's `StructuralRecognizerInput` also needs a
  face's own real `effects`/`triggers`/`abilities` — already present on the
  already-imported `CardDefinition`/`.backFace` this script dynamic-imports for
  every card, just not previously threaded through to the per-face input
  object. Fixed by adding those three fields to both the front/back `faces`
  entries and the per-recognizer `input` object; Recognizers A/B simply ignore
  the extra fields (no separate wiring path needed per recognizer).
- **Real, whole-pool run reproduces the prototype's own 7-accept/4-decline
  split exactly**, re-verified independently of the prototype's own test file
  (a standalone script driving `recognizeDestroyEffectStructural` through the
  SAME real oracle-text-by-Scryfall-name loader `apply-recognizers.mjs` itself
  uses, not the test file's fixture loader): accepts `summon-bahamut`,
  `fate-of-the-sun-cryst`, `battle-menu`, `lunatic-pandora`,
  `sephiroth-s-intervention`, `sidequest-hunt-the-mark`, Dion's back face
  (Bahamut, Warden of Light); declines `qutrub-forayer`, `deadly-embrace`,
  `ultima-weapon`, `summon-primal-odin` — identical to the prototype's own
  findings above, no divergence.
- **Real divergence, worth flagging explicitly: RECOGNIZER ACCEPT ≠ NEW FACT
  WRITTEN for 4 of the 7 accepted cards.** `apply-recognizers.mjs`'s own
  pre-existing dedup discipline (`coreKey`, deliberately ignoring `value`) —
  the same discipline that made Recognizers A/B's earlier wiring pass a no-op
  for cards that already had an identical hand-authored fact — applies here
  too: `summon-bahamut`, `fate-of-the-sun-cryst`, `battle-menu`, and Dion's
  back face all ALREADY had an exactly-equivalent hand-authored `event:
  'destroy'` fact (same `target`/`targeted` shape, differing only in the old
  `value: -1` placeholder vs. this recognizer's real `1` — precisely the case
  `coreKey`'s own doc comment says should count as "already covered," not
  "missing"). Only the 3 cards the prototype's own "real, useful side-finding"
  bullet already flagged as genuinely missing the fact today
  (`lunatic-pandora`, `sephiroth-s-intervention`,
  `sidequest-hunt-the-mark-yiazmat-ultimate-mark`) actually gained a NEW
  `provenance`-tagged `event:'destroy'` fact from this wiring pass.
  **Concretely: `summon-bahamut` (fin/1) itself gets ZERO new facts from this
  wiring pass** — its own pre-existing hand-authored destroy fact is
  untouched, still has no `provenance` field. This is a real, deliberate
  consequence of "additive only, never touch an existing hand-authored fact"
  — not a bug, but worth being explicit about since the motivating example
  for this whole recognizer happens to be exactly the one card that doesn't
  visibly change in the UI as a result of this pass.
- **Verification, this pass**: `npx vitest run functional-model` 419/419 pass
  (unchanged); `npm run typecheck` (nuxt typecheck / vue-tsc) — same 2
  pre-existing baseline errors (`functional-model/mana.ts`,
  `server/api/tokens/by-key.ts`), both unrelated to this change, 0 new;
  `verify-synergy.mjs` 0 hard failures pool-wide (the 3 newly-added destroy
  facts on `lunatic-pandora`/`sephiroth-s-intervention`/`sidequest-hunt-the-
  mark` surface only as soft notes or nothing at all, same accepted
  parser-fact-evidence downgrade the second wiring pass already put in
  place); `verify-annotation-coverage.mjs`/`verify-scenario-card-names.mjs`
  both clean; `find-synergies.mjs` runs clean end-to-end; re-running
  `apply-recognizers.mjs` a second time adds 0 new facts (idempotent,
  confirmed).
- **Not done in this pass**: the Facts-tab toggle/provenance UI, per-card
  review-scope narrowing, and the "rule review" lane are all still open
  (unchanged from the second wiring pass's own list). Whether the
  already-covered-by-an-identical-fact case above should ever retroactively
  backfill `provenance` onto a pre-existing hand-authored fact (rather than
  leaving it untouched, unprovenanced) is a real open design question this
  pass surfaced but did not decide — flagged, not resolved.

## Resolved (2026-09-13, this discussion)

- Provenance kept separate from agent-authored facts; identical Fact
  format/shape either way.
- Retroactive fixing accepted as the safety net for rare parser mistakes —
  no requirement for exhaustive upfront rule coverage of every MTG
  exception, and no hard trace-verification gate before trusting a fact.
- Full coverage triggers agent scrutiny, not agent bypass; partial
  coverage triggers normal agent authorship of the remainder.
- Facts tab gets a show/hide toggle for parser facts — not permanent
  visibility, not permanent hiding.
- Scenario-generation extension is a plausible, lower-priority future
  idea, not required now.
- Per-card override-a-parser-fact capability deferred until an actual
  need surfaces.

## Dedup-match retagging closed (2026-09-13, follow-up pass)

The "real open design question this pass surfaced but did not decide" bullet
right above this section is now DECIDED and IMPLEMENTED, not just
discussed: a recognizer's derived fact that dedups (on `coreKey`) against an
ALREADY hand-authored fact no longer leaves that fact silently
unprovenanced. **This directly supersedes the "summon-bahamut (fin/1) itself
gets ZERO new facts from this wiring pass" claim above** — that was true at
the time it was written, is no longer true, and is left in place above only
as a historical record of that pass, not current behavior.

- `functional-model/scripts/apply-recognizers.mjs`'s dedup path
  (`coreKey` match against an existing fact) now branches on whether that
  existing fact already carries `provenance`:
  - No `provenance` yet (the "predates the recognizer" case): the existing
    fact is RETAGGED in place — `provenance: { origin: 'parser', rule,
    note }` is added; every other field (`value`, `annotations`,
    `controller`, everything) is left byte-for-byte untouched. `note`
    (new optional `FactProvenance.note`, `synergy.ts`) is a short
    documentary string explaining the fact predates the recognizer and was
    independently reconciled/confirmed by it — same "not consulted by
    matching logic" bucket as `provenance` itself.
  - Already has `provenance` (a prior run's own retag, or two
    recognizers/faces independently deriving the identical claim):
    genuinely nothing new to say, counted as already-covered, untouched
    (idempotent — confirmed by running the script twice in a row).
- **Real whole-pool run, this pass**: 0 new parser-originated facts (the
  pool was already fully migrated from the third-recognizer pass above),
  **163 existing hand-authored facts retagged with provenance** —
  `permanent-enters-battlefield-normally`: 113, `instant-sorcery-resolves-
  to-graveyard`: 46, `destroy-effect-structural`: 4. `summon-bahamut`
  (fin/1) is 2 of those 4 destroy-recognizer retags' siblings — it actually
  got 2 retagged facts (`entersBattlefield` via
  `permanent-enters-battlefield-normally`, `destroy` via
  `destroy-effect-structural`), both with their real pre-existing
  `value`/`annotations` untouched (the `destroy` fact's own `value: -1`
  placeholder is preserved exactly, NOT overwritten with the recognizer's
  own `1`).
- **Live-verified in the browser, not just data inspection**: `/app/card/
  fin/1` (summon-bahamut) and `/app/card/fin/29` (Phoenix Down, a second
  retagged card) both show the retagged facts under the Facts tab's
  existing "Show parser-derived facts" toggle, each with a working
  hover popover ("Parser-derived — rule: `<rule>`" + the real recognizer
  source).
- **Real bug found and fixed by this same live-verification step, one file,
  card-owned but mechanical/non-semantic**: `server/api/recognizer-source/
  [rule].get.ts`'s hand-kept `RECOGNIZER_IDS` runtime array (a mirror of
  `functional-model/recognizers/types.ts`'s `RecognizerId` union, which
  already included `'destroy-effect-structural'` from that recognizer's own
  earlier wiring pass) was never widened to match — every `destroy`-fact
  provenance popover 404'd ("Could not load recognizer source") until this
  was fixed. Flagged explicitly since it's outside `functional-model/`, but
  fixed directly (one array literal, no recognizer-behavior change) rather
  than left as a known-broken caveat.
- Verification: `npx vitest run functional-model` 419/419 pass (unchanged);
  `npm run typecheck` — same 2 pre-existing baseline errors
  (`functional-model/mana.ts`, `server/api/tokens/by-key.ts`), 0 new;
  `verify-synergy.mjs` 0 hard failures pool-wide; `verify-annotation-
  coverage.mjs`/`verify-scenario-card-names.mjs` clean; `find-synergies.mjs`
  clean end-to-end; re-running `apply-recognizers.mjs` a second time retags
  0 additional facts (idempotent, confirmed); only `cards/<slug>/
  synergy.json` files changed pool-wide (no `definition.ts`/`progress.json`
  touched by this pass).
- **Still open, unchanged**: the Facts-tab toggle/provenance UI itself was
  ALREADY built (this pass found it working, didn't build it) — remaining
  open items are per-card review-scope narrowing to exclude parser facts
  and the separate "rule review" lane for auditing the recognizer catalog,
  both still not designed/built.

## Fourth recognizer: `drawCard-effect-structural` (2026-09-13)

Reads `kind: 'drawCard'` `Effect`s directly off a `CardDefinition`'s own
structured data (never oracle text, never Forge script) — the same
structural-recognizer approach `destroy-effect-structural` established, now
applied to a second `Effect` kind. Its own container-walking machinery
(`collectEffects`/`allEffects`/`StructuralRecognizerInput`) was factored out
of `destroy-effect-structural.ts` into a new shared
`functional-model/recognizers/structural-effects.ts` — byte-for-byte
identical between the two recognizers, only WHICH `Effect.kind` each filters
for differs, so duplicating it a second time would have been pure copy-paste
with no independent reason to diverge. `destroy-effect-structural.ts` now
re-exports `StructuralRecognizerInput` from that shared file for backward
compatibility with its own existing test file's import.

**Motivating real card, same one the user cited for the destroy
recognizer**: `cards/summon-bahamut/definition.ts` (fin/1) chapter III —
`{ kind: 'drawCard', amount: 2 } satisfies Effect`. `card.ts:347`'s real
type: `{ kind: 'drawCard'; amount?: Computed<number> }` — an omitted
`amount` resolves to a literal `1` at resolution (`card.ts`'s own
`applyEffect`), so this recognizer treats "no `amount` field" and
"`amount: 1`" identically. 58 real `kind: 'drawCard'` Effect occurrences
across 48 distinct real pool card files (grepped
`functional-model/cards/*/definition.ts` first, same discipline the
destroy recognizer's own build used).

### `value` convention — fixed `1`, never copied from `amount`

Checked the real pool's existing hand-authored `event:'drawCard'` facts
first (20 real cards, before writing any recognizer code): every one that
has moved past the old `-1` "pending `compute-weights.mjs`" placeholder
reads `value: 1` regardless of how many cards the effect actually draws —
`summon-bahamut`'s own chapter III draws 2, its hand-authored fact still
read `value: 1`; `qiqirn-merchant`'s `bigDraw` ability draws 3, same
`value: 1`; `travel-the-overworld` draws 4, same `value: 1`. This confirms
`value` on this fact SHAPE is a fixed weight, not a literal card count — the
same convention `destroy-effect-structural`'s own `value: 1` established
(that recognizer's own doc comment gives the identical reasoning for
`qty`). The recognizer asserts `value: 1` on every fact it produces; it
never attempts to derive a "real" value from `amount`.

### Real declines found, checked against the whole pool

- **Non-literal `amount` (a `Computed<number>` closure) — the same opaque-
  closure wall `destroy-effect-structural`'s own `qty`/`minPower` check
  already established.** Real hits: `deadly-embrace`, `edgar-king-of-figaro`,
  `kefka-court-mage-kefka-ruler-of-ruin`'s own `onOpponentLosesLife` trigger
  (back face only), `shantotto-tactician-magician`, `summon-fenrir`,
  `jenova-ancient-calamity`, `nibelheim-aflame`, `tellah-great-sage`,
  `summon-shiva`, and `sephiroth-fabled-soldier-sephiroth-one-winged-angel`'s
  own back face (One-Winged Angel's real "sacrifice any number... draw THAT
  MANY cards", `ctx.triggerInput?.sacCount`).
- **A literal `amount` with no confirmed template** — only 1 (or omitted),
  2, 3, 4 are confirmed against a real pool card (`summon-bahamut`: 2,
  `qiqirn-merchant`'s `bigDraw`: 3, `travel-the-overworld`: 4); no real card
  needs a 5th, so a literal `amount` outside that set declines rather than
  guessing at its plural templating.
- **A literal `amount` that's an ENGINE-SIDE APPROXIMATION of a real
  VARIABLE draw the oracle text never states as a fixed number at all** —
  the interesting failure direction, opposite of the destroy recognizer's
  own trailing-qualifier case: the built clause simply never appears
  verbatim, so this recognizer declines for free, no special-casing needed:
  - `joshua-phoenix-s-dominant-phoenix-warden-of-fire`'s own front face:
    `{amount: 2}`, but the real oracle reads "discard up to two cards, THEN
    DRAW THAT MANY CARDS" — `definition.ts`'s own comment already flags the
    fixed `2` as "the honest approximation," not a literal transcription.
  - `kefka-court-mage-kefka-ruler-of-ruin`'s own front-face `onEnter`/
    `onAttacks` triggers: `{amount: 2}`, but the real oracle reads "you draw
    a card FOR EACH CARD TYPE among cards discarded this way" (also
    variable, also an approximation).
  - `combat-tutorial`: `{amount: 2}`, but the real oracle reads "TARGET
    PLAYER DRAWS two cards" (third person, targeting ANY player — this
    card's own effect always draws for `ctx.you` regardless, a separate,
    already-documented engine gap). The built imperative clause "Draw two
    cards" never appears (the real text says "draws," not "draw"), so this
    declines without the recognizer needing to know anything about
    targeting at all.
- **"May draw" — an effect this recognizer can't tell apart from an
  unconditional draw, since `card.ts`'s own `drawCard` Effect kind has NO
  `optional` field at all (unlike `destroy`'s own `optional?: boolean`).**
  `rook-turret`'s real "you MAY draw a card. If you do, discard a card." —
  the draw itself is the player's own choice, not guaranteed, which this
  engine's `drawCard` Effect has no way to represent; asserting an
  unconditional `event:'drawCard'` fact here would overclaim. Declined via
  a negative lookbehind on the literal word "may" immediately preceding the
  match — grepped the whole real pool for this exact "may draw" shape
  first; `rook-turret` is the only real hit.
- **No `kind:'drawCard'` Effect on this face at all** — the baseline
  decline, same as every other recognizer. Two notable real cases beyond
  the obvious "this card doesn't draw cards": `venat-heart-of-hydaelyn-
  hydaelyn-the-mothercrystal`'s own back face (Hydaelyn's conditional "if
  that creature is legendary, draw a card" lives INSIDE a `custom` effect's
  closure — `ctx.you.drawCard()` called directly, never a separate `kind:
  'drawCard'` sibling effect, so this recognizer correctly can't see it at
  all), and `stiltzkin-moogle-merchant` (a real card with an existing
  hand-authored `event:'drawCard'` fact but genuinely no structural
  `kind:'drawCard'` Effect anywhere in its own `definition.ts` — its draw is
  modeled some other way this recognizer has no visibility into).

### Real accepted boundary characters — wider than the destroy recognizer's own strict set

Checked against every real literal-`amount` pool card before adding either:
a comma (`,` — "draw a card, then discard a card," a real, common template
this pool uses often: `adventurer-s-airship`, `emet-selch-unsundered-hades-
sorcerer-of-eld`, `locke-cole`, `qiqirn-merchant`'s own `cantrip` ability,
`sidequest-card-collection-magicked-card`, and once mid-quoted-text in
`thief-s-knife`'s own granted-ability string), and `" and "` (a real
coordinating conjunction joining a SECOND, independently-represented effect
on the SAME card, not an uncaptured qualifier — `circle-of-power`'s own "You
draw two cards AND you lose 2 life" and `seymour-flux`'s own "draw a card
AND put a +1/+1 counter on Seymour Flux," both checked to confirm the
"and"-clause always corresponds to a real, separately-modeled effect
elsewhere on the same card, never a hidden qualifier on the draw itself).

### Real per-face multiplicity: dedup vs. genuinely-separate facts

Every real multi-`drawCard`-effect face in the pool maps to ONE shared real
clause and dedups to one fact (`emet-selch-unsundered-hades-sorcerer-of-eld`'s
onEnter/onAttacks pair, `matoya-archon-elder`'s onScry/onSurveil pair,
`summon-anima`'s 3 identical chapters, `jecht-reluctant-guardian-braska-s-
final-aeon`'s back-face chapterI/II pair) — **except `qiqirn-merchant`**,
whose own two activated abilities (`cantrip`'s bare draw, `bigDraw`'s
literal 3) are genuinely TWO separate real clauses at two separate
positions in the same oracle text, each independently matched once and
correctly NOT deduped (their built facts differ by `annotations`).

### Real bug found and fixed while wiring into `apply-recognizers.mjs`: `existingByKey` assumed at most one candidate per `coreKey`

`qiqirn-merchant` surfaced a real, previously-latent bug in the wiring
script's own dedup/retag logic (present since the original `destroy-effect-
structural` wiring, never triggered until a recognizer that regularly
produces >1 fact per face with an identical bare `coreKey` existed): its 2
genuinely different `event:'drawCard'` facts (different `annotations`,
deliberately excluded from `coreKey`) reduce to the exact same bare
`{"event":"drawCard"}` key. The old single-value `Map<string, Fact>` would
let the second recognized instance's own lookup find the FIRST existing
fact (already retagged by the first instance) and skip it as "already
covered" — permanently leaving the second real fact unprovenanced.

Fixed `existingByKey` to `Map<string, Fact[]>`. The first attempt at this
fix ("retag the first existing candidate that lacks `provenance`, per
recognized instance") correctly fixed `qiqirn-merchant` but broke
IDEMPOTENCY on a genuinely different real case, caught by re-running the
script a second time and diffing: `matoya-archon-elder` also has 2 existing
`event:'drawCard'` facts sharing this same bare key, but they are NOT the
same real claim — one is anchored to the real "draw a card" clause, the
other to this card's own reminder-text parenthesis ("(Draw after you scry
or surveil.)"), and this recognizer only ever independently re-derives the
FIRST. The "first unprovenanced candidate wins" policy retagged the real
one on run 1, then — since run 2's own recognized fact is identical and the
real candidate is now provenanced — incorrectly advanced to retagging the
REMINDER-TEXT fact on run 2, a fact this recognizer never actually matched
at all. Caught via a real before/after diff (not assumed), and the
incorrectly-applied retag was manually reverted in
`cards/matoya-archon-elder/synergy.json` before landing the real fix.

**Real fix, landed**: when more than one candidate shares a `coreKey`,
require an EXACT `annotations` match to pick which one a recognized
instance corresponds to (falls back to the original single-candidate
behavior, unchanged, when only one candidate exists — an existing fact's
hand-authored annotation legitimately can differ from what a recognizer
independently computes for the same real claim in that case, which is why
`coreKey` deliberately excludes `annotations` to begin with). Re-verified:
`qiqirn-merchant`'s own 2 facts both retag correctly in one run (their
`annotations` exactly match their own recognized counterparts, checked);
`matoya-archon-elder`'s reminder-text fact is now correctly, stably left
alone across any number of runs; a full second run pool-wide after the fix
retags 0 additional facts (genuinely idempotent). See
`functional-model/scripts/apply-recognizers.mjs`'s own updated header
comment for the in-code version of this reasoning.

**Also checked, not otherwise acted on**: grepped the WHOLE pool (not just
drawCard-shaped facts) for any two existing facts sharing an identical
`coreKey` — 79 dup-key groups found. All but the 3 drawCard-relevant ones
(`qiqirn-merchant`, `matoya-archon-elder`, and `summon-leviathan`, which
has no structural `drawCard` Effect at all and so is never touched by this
recognizer) are bare `zone:'Battlefield'`-shaped SINK facts, a shape no
recognizer in this pool has ever produced (every recognizer here only ever
produces `role:'source'` facts) — so this fix is a strict correctness
improvement with no regression risk for the other 3 recognizers' own
already-retagged facts.

### Real whole-pool run

`npx vite-node functional-model/scripts/apply-recognizers.mjs` (no args,
whole pool): **20 new parser-derived `event:'drawCard'` facts added, 14
existing hand-authored facts retagged with provenance**
(`drawCard-effect-structural`: 14) — `summon-bahamut` (fin/1) is one of the
14 retags, its own real `value: 4` placeholder preserved exactly (NOT
overwritten with the recognizer's own fixed `1`). Re-running a second time
(after the `existingByKey` fix above) adds 0 new facts and retags 0
additional facts — genuinely idempotent, confirmed.

**Live-verified in the browser**: `/app/card/fin/1`'s Facts tab, with "Show
parser-derived facts" toggled on, shows a "Card draw" row tagged with the
parser-derived icon; hovering it opens a popover reading "Parser-derived —
rule: drawCard-effect-structural" with the real recognizer source rendered
below (confirmed via a real network response, `GET /api/recognizer-source/
drawCard-effect-structural` → `200`, not a 404 — `server/api/recognizer-
source/[rule].get.ts`'s `RECOGNIZER_IDS` allowlist was updated ALONGSIDE
this recognizer's own wiring pass this time, specifically to avoid
repeating the destroy-effect-structural allowlist-miss bug from the
previous pass).

### Verification

`npx vitest run functional-model` → 442/442 pass (up from 419; the new
`drawCard-effect-structural.test.ts` accounts for the +23, plus the shared
`structural-effects.ts` extraction changes nothing observable in
`destroy-effect-structural.test.ts`, which still passes unchanged). `npm run
typecheck` → same 2 pre-existing baseline errors (`functional-model/
mana.ts`, `server/api/tokens/by-key.ts`), 0 new. `verify-synergy.mjs` → 0
hard failures pool-wide (unchanged). `verify-annotation-coverage.mjs`/
`verify-scenario-card-names.mjs` → clean. `find-synergies.mjs` → runs clean
end-to-end. Only `cards/<slug>/synergy.json` files changed pool-wide (plus
the one manual revert in `matoya-archon-elder/synergy.json` described
above) — no `definition.ts`/`progress.json` touched.

**Not done, still open, unchanged from the third-recognizer pass**: the
Facts-tab toggle/provenance UI was already built and needed no changes;
per-card review-scope narrowing to exclude parser facts and the separate
"rule review" lane for auditing the recognizer catalog are both still not
designed/built. Forge-verification of this recognizer's own draw-card
removal-templating assumptions specifically is the same "trained
knowledge, not yet checked against a rules-text mirror" caveat every prior
recognizer in this catalog still carries — not closed by this pass either.

## Fifth recognizer: `saga-lore-and-sacrifice-structural` (2026-09-13)

Reads a `CardDefinition`'s own `typeLine` + named `triggers` STRUCTURE
directly (never oracle text, never Forge script) — genuinely different
shape from Recognizers C/D (which read `Effect[]`): this one mirrors the
real, battle-tested engine derivation `functional-model/saga.ts` already
proves out (`isSaga`/`maxChapterOf`), rather than re-deriving an
oracle-text-pattern equivalent of the same question. Produces two real 714
(Saga) facts:
- 714.2c: an unconditional, recurring lore-counter-placement fact
  (`{event:'putCounter', counterType:'LORE', target:'self', value:1}`) —
  every real Saga in the pool gets one, no exceptions found.
- 714.4: a `sacrifice` + `dies` fact PAIR (self, unconditional,
  `value:1` each) once lore counters reach the Saga's own greatest
  chapter — asserted ONLY when the final chapter's own `effects` array
  (recursively, through any `modal` mode, via the shared `collectEffects`
  walker) contains ZERO `kind:'custom'` entries. A `custom` effect's own
  closure body is opaque to any static recognizer (same wall
  `structural-effects.ts`'s own doc comment names for Recognizers C/D), so
  whether a given chapter secretly transforms the permanent back (which
  would reset its lore counters via a real zone change and correctly skip
  714.4's sacrifice, per `saga.ts`'s own header) can't be read from
  outside — this recognizer declines the pair whenever the final chapter
  has ANY `custom` effect, even for a real card that doesn't actually
  transform back, a real accepted false negative, same discipline every
  recognizer in this catalog already follows.

**Real pool checked before writing any recognizer code**: 21 real Sagas
(`typeLine` or `backFace.typeLine` containing `Saga`, confirmed via named
`chapterI`..`chapterV` triggers) — 15 plain, 6 transforming
(`crystal-fragments-summon-alexander`, `dion-bahamut-s-dominant-bahamut-
warden-of-light`, `esper-origins-summon-esper-maduin`, `jecht-reluctant-
guardian-braska-s-final-aeon`, `joshua-phoenix-s-dominant-phoenix-warden-
of-fire`, `jill-shiva-s-dominant-shiva-warden-of-ice`). One of the 15 plain
Sagas, `summon-g-f-cerberus`, has a completely empty `synergy.json` (no
facts authored at all yet, `source: []`/`sink: []`) — `apply-
recognizers.mjs`'s own pre-existing `isV2Shaped` gate correctly excludes it
(same restraint every recognizer in this catalog already respects: never
originate a fact array for an unauthored card), so it's outside this pass's
real counts below, a pre-existing gap unrelated to this task.

### `value` convention — fixed `1`, same as every prior structural recognizer

Checked the real pool's own existing hand-authored `putCounter`/
`sacrifice`/self-`dies` facts first: the modern convention across most of
the pool (`summon-choco-mog`, `summon-leviathan`, `summon-primal-garuda`,
`summon-shiva`, ...) already reads `value: 1` for all three; only
`summon-bahamut` and `summon-knights-of-round` still carry the older `-1`
"pending `compute-weights.mjs`" placeholder for the identical real claim.
`apply-recognizers.mjs`'s own `coreKey` dedup (which deliberately excludes
`value`) retags those two in place without overwriting their own real
`-1` — confirms existence/shape, never magnitude, same rule the dedup pass
already enforces for every other recognizer.

### Annotation — anchored to the literal word "Saga" in `typeLine`

Same precedent `permanent-enters-battlefield-normally.ts` already sets for
a fact with nothing in the oracle text BODY to point at (a purely
structural claim licensed by the card's own basic identity, not its
ability text): anchor to `typeLine`. Unlike that recognizer (which anchors
to the real card-type word(s) BEFORE the em dash, via `type-line-span.ts`'s
`typeWordsSpan`), this recognizer's own claim is licensed specifically by
the literal `Saga` SUBTYPE word (CR 714.1's own test) — so it anchors to
that exact word's own span, wherever it falls in the typeLine (after the
em dash, among the subtypes), a small new span helper rather than reusing
`typeWordsSpan`.

### Real per-card outcomes, checked against the whole pool

Full triple (lore + sacrifice + dies, final chapter has no `custom`
effect) — 13 cards: `summon-anima`, `summon-bahamut`, `summon-choco-mog`,
`summon-esper-ramuh`, `summon-fat-chocobo`, `summon-fenrir`, `summon-
knights-of-round`, `summon-primal-garuda`, `summon-primal-odin`, `summon-
shiva`, `summon-titan` (all plain), plus `esper-origins-summon-esper-
maduin` and `jecht-reluctant-guardian-braska-s-final-aeon` (both
transforming).

Lore-only (final chapter has a `custom` effect, sacrifice+dies correctly
declined) — 7 cards: `summon-brynhildr`, `summon-g-f-ifrit`, `summon-
leviathan` (all plain), plus `crystal-fragments-summon-alexander`, `dion-
bahamut-s-dominant-bahamut-warden-of-light`, `joshua-phoenix-s-dominant-
phoenix-warden-of-fire`, `jill-shiva-s-dominant-shiva-warden-of-ice` (all
transforming). `summon-g-f-cerberus` (the empty-synergy.json card above)
would also land in this bucket once it's authored at all, but is untouched
by this pass.

**A real, checked-not-guessed surprise**: `jecht-reluctant-guardian-
braska-s-final-aeon` was flagged going in as "likely still uses a custom
effect for its own unique ability" (a reasonable guess, since its FRONT
face's own transform trigger IS a `custom` effect) — checked directly
against its own `backFace.triggers` and found chapter III's own real work
is a plain `{kind:'sacrifice', owner:'opponents', validType:'creature',
qty:2}` Effect, no `custom` at all. `saga.ts`'s own header independently
confirms this card does NOT transform back. So this recognizer correctly
ACCEPTS the full triple here — not a false negative, the initial guess was
simply wrong and the direct check caught it before it became a decline
that didn't need to be one.

**Two real, deliberate divergences from today's existing hand-authored
data**, same `zack-fair`-style precedent `permanent-enters-battlefield-
normally.ts`'s own module doc comment already establishes (a recognizer
declining to add a fact never removes or contradicts an already-authored
one): `summon-leviathan` and `crystal-fragments-summon-alexander` (back
face) both already carry a hand-authored `sacrifice`+`dies` self-pair in
their real `synergy.json`, but their own final chapters use a `custom`
effect for an entirely unrelated reason (a batch type-filtered creature
bounce, and a tap-all-opponents-creatures effect, respectively — neither
is a transform-back) — this recognizer declines the pair for both anyway,
per the letter of its own conservative rule, leaving their existing
hand-authored facts untouched and unprovenanced. Worth a human eventually
teaching this recognizer to tell "custom effect that also transforms back"
apart from "custom effect for an unrelated reason," but that needs real
static insight into what a `custom` closure's `run` body actually does —
out of reach for any recognizer in this family by construction.

### Real whole-pool run

`npx vite-node functional-model/scripts/apply-recognizers.mjs` (no args,
whole pool, all 5 recognizers): **32 new parser-derived facts added** (13
full triples × up to 3 facts each, minus however many of each triple's
facts already existed hand-authored and got retagged instead — see below
— plus the lore-only cards' single new `putCounter` fact each), **14
existing hand-authored facts retagged with provenance**
(`saga-lore-and-sacrifice-structural`: 14) — `summon-bahamut` (fin/1) is 3
of those 14 (its own real `putCounter`/`sacrifice` legacy `-1` values and
`dies` `1` value all preserved exactly, only `provenance` added);
`jill-shiva-s-dominant-shiva-warden-of-ice`'s own single existing
`putCounter` fact (back face) is another. Re-running the script a second
AND third time adds 0 new facts and retags 0 additional facts — genuinely
idempotent, confirmed across 3 consecutive runs. `20` of the `21` real
Sagas were touched (`summon-g-f-cerberus` excluded, empty `synergy.json`,
see above).

**Live-verified in the browser**: `/app/card/fin/1` (Summon: Bahamut)'s
Facts tab, "Show parser-derived facts" toggled on, shows "Counters" (self
· LORE counters), "Sacrifice" (self), and "Dies" (self) rows each tagged
with the parser-derived icon; hovering the icon on the "Counters" row
opens a popover reading "PARSER-DERIVED — RULE: SAGA-LORE-AND-SACRIFICE-
STRUCTURAL" with the real recognizer source rendered below (confirmed via
a real network response, `GET /api/recognizer-source/saga-lore-and-
sacrifice-structural` → `200`, not a 404 — `server/api/recognizer-source/
[rule].get.ts`'s `RECOGNIZER_IDS` allowlist was updated ALONGSIDE this
recognizer's own wiring pass, same pass, avoiding the destroy-effect-
structural allowlist-miss repeat a second time). `/app/card/fin/58` (Jill,
Shiva's Dominant // Shiva, Warden of Ice)'s back face ("OTHER FACES/
FUNCTIONS" section) shows the "Counters" row tagged the same way but
correctly shows NO "Sacrifice"/"Dies" self-row at all — the lore-only
outcome, live-confirmed, not just asserted from the JSON.

### Verification

`npx vitest run functional-model` → 452/452 pass (up from 442; the new
`saga-lore-and-sacrifice-structural.test.ts` accounts for the +10). `npm
run typecheck` → same 2 pre-existing baseline errors (`functional-model/
mana.ts`, `server/api/tokens/by-key.ts`), 0 new. `verify-synergy.mjs` → 0
hard failures pool-wide (unchanged). `verify-annotation-coverage.mjs`/
`verify-scenario-card-names.mjs` → clean. `find-synergies.mjs` → runs clean
end-to-end. Only `cards/<slug>/synergy.json` files changed pool-wide (20
Saga cards) — no `definition.ts`/`progress.json` touched.

**Not done, still open, unchanged from prior recognizer passes**: the
Facts-tab toggle/provenance UI was already built and needed no changes;
per-card review-scope narrowing to exclude parser facts and the separate
"rule review" lane for auditing the recognizer catalog are both still not
designed/built. Forge-verification of this recognizer's own 714.2c/714.4
citations specifically is the same "trained knowledge (`saga.ts`'s own
already-cited Forge/CR sourcing), not independently re-checked against a
rules-text mirror by THIS pass" caveat every prior recognizer in this
catalog still carries — not newly closed here (this recognizer leans on
`saga.ts`'s own prior verification rather than re-deriving it). The
"custom effect for an unrelated reason vs. custom effect that also
transforms back" blind spot named above (`summon-leviathan`/
`crystal-fragments-summon-alexander`) is a real, still-open limitation of
this whole recognizer, not something this pass closes.

## `kind:'scope'` vs `kind:'mismatch'` declines, hard-fail-on-mismatch (2026-09-13)

Every prior pass's own decline path was silently swallowed by
`apply-recognizers.mjs` identically (`if (!result.matched) continue;`, no
distinction, no logging) — this closes that gap for real structural
divergences, without changing the silent-and-correct case at all.

- `RecognizerResult`'s `matched: false` branch (`recognizers/types.ts`) now
  carries an optional `kind?: 'scope' | 'mismatch'` — `'scope'` (the
  implicit default; every existing decline path in every recognizer stays
  here unchanged) means no structural basis to even try; `'mismatch'` means
  a pattern WAS built from the card's own structured data but 0 or 2+
  verbatim matches were found against the real oracle text — a real
  divergence between the recognizer's own model and the card's real prose,
  either a recognizer bug or a known, accepted structural approximation.
  Only `destroy-effect-structural`'s and `drawCard-effect-structural`'s own
  "built a pattern, `oracleText.matchAll` found 0 or 2+ matches" decline
  paths return `kind:'mismatch'` — every other decline in those same two
  recognizers (non-literal field, no confirmed template, owner-restricted,
  etc.) stays `'scope'`, untouched. `saga-lore-and-sacrifice-structural`
  never builds a text pattern at all (it reads `typeLine`+named triggers,
  never `oracleText`), so it has no `'mismatch'`-shaped decline path to
  begin with — nothing there needed changing. Recognizers A/B
  (text-only, no "build pattern then verify" step) are untouched.
- **`rook-turret`'s own "may draw a card" decline is classified
  `kind:'scope'`, not `'mismatch'`**, even though it's also a "0 matches"
  outcome mechanically — a judgment call, reasoned through explicitly: the
  negative-lookbehind exclusion of "may draw" is an INTENTIONAL, designed-in
  guard (`kind:'drawCard'` has no `optional` field at all, so this
  recognizer can never represent an optional draw and correctly never
  tries), not a case where the recognizer's own model of the card's prose
  turned out wrong. Same category as `destroy-effect-structural`'s own
  unconditional `owner`-restricted decline.
- **`apply-recognizers.mjs` now hard-fails (non-zero exit) on any
  unresolved `kind:'mismatch'` decline collected across the WHOLE pool run**
  (never aborts mid-run — every mismatch is collected first, then reported
  together at the end), unless suppressed by a `// recognizer-exception:
  <rule-id> — <reason>` comment marker anywhere in that card's own
  `definition.ts` (grepped from a cheap extra `readFile` of the same path
  already resolved for the dynamic `import()`). A suppressed mismatch is
  logged as a skip, not a failure.
- **Real pool cases retrofitted with the marker** (the 4 already-documented,
  real, checked cases from the recognizer passes above): `qutrub-forayer`
  (`destroy-effect-structural` — the trailing "that was dealt damage this
  turn" qualifier), `combat-tutorial`, `joshua-phoenix-s-dominant-phoenix-
  warden-of-fire` (front face only), `kefka-court-mage-kefka-ruler-of-ruin`
  (front face only, covers both its `onEnter`/`onAttacks` triggers — same
  shared effects) — all three `drawCard-effect-structural`, all three real
  cases where a literal `amount` is a fixed-count approximation of prose
  that's actually variable/third-person.
- **Guard proven working, not just theorized**: the `qutrub-forayer` marker
  was temporarily removed and the script re-run directly against the 5
  affected slugs — hard-failed with exit code 1, printing the exact
  card/rule/reason (`qutrub-forayer [front] rule=destroy-effect-structural:
  ...`), while the other 3 markers stayed suppressed correctly. Marker
  restored, re-run confirmed clean (exit 0) again.

## Real, separate bug found and fixed in the same pass: `coreKey` duplicate facts (2026-09-13)

Found while doing final live-verification for the above (not what this pass
set out to fix, folded in since it's the same file): `coreKey`'s dedup logic
(deliberately excludes `value`/`controller`/`annotations`/`provenance`/
`targeted`, per its own existing doc comment) never normalized `subject`,
so a legacy hand-authored self-referencing fact with bare `target:'self'`
(no `subject` key at all — predates the 2026-09-11 `synergy.ts` merge that
added `subject:'self'` alongside `target:'self'` for this exact case) hashed
to a DIFFERENT key than `permanent-enters-battlefield-normally`'s own
recognizer-produced fact (which DOES carry `subject:'self'`) — so instead of
retagging the existing fact in place, earlier recognizer-wiring passes
appended a visible near-duplicate next to it. Confirmed via a direct pool
scan (grouping same-face facts by a reduced key ignoring only
provenance/annotations/value/controller): **12 real pool cards** had a
genuine duplicate `entersBattlefield`/`cast` fact pair (`summon-bahamut`/
fin-1 showing 2 "Enters the battlefield" rows was the most visible case;
`dion-bahamut-s-dominant-bahamut-warden-of-light`/`jill-shiva-s-dominant-
shiva-warden-of-ice` each had 1 real dup among their own larger multi-fact
`entersBattlefield` sets, the rest of which are genuinely distinct real
facts — token-entering, return-from-exile — correctly NOT touched).

- **Fix**: `coreKey` now takes an options bag (`{ normalizeSelfSubject =
  true }`); when `target === 'self'` and `subject` is either absent or
  already `'self'`, `subject` is dropped from the reduced key before
  hashing — deliberately narrow (a non-default `subject`, e.g. a `{token:
  ...}` reference, keeps distinguishing facts apart; this only ever
  collapses the `'self'`-vs-absent case).
- **Cleanup of already-written damage**: a new `mergeDuplicateFacts`
  self-heal pass runs on every invocation, over a card's own `source` array
  ONLY (never `sink` — a prior whole-pool scan found 79 pre-existing
  same-coreKey groups, almost all legitimately-distinct `zone:'Battlefield'`
  SINK facts no recognizer here has ever produced; blindly merging those
  would have destroyed real, unrelated data). Two required gates before
  merging a same-coreKey group, not just "any two facts sharing a key":
  (1) the group must be one the subject-normalization fix itself actually
  CREATED — checked by also computing the PRE-fix key
  (`normalizeSelfSubject: false`) for every member; a group that already
  collided even pre-fix is a DIFFERENT, already-known ambiguity the main
  recognizer loop's own multi-candidate + exact-`annotations`-match logic
  already owns, out of scope here; (2) of the members that do differ
  pre-fix, exactly one must lack `provenance` (the original hand-authored
  fact) and the rest must carry it (a prior buggy run's own appended
  duplicate) — the confirmed, exact shape of the real bug. A group that
  clears gate 1 but not gate 2 is logged and left untouched, not guessed at.
- **A real near-miss, caught and fixed before landing**: a first, broader
  version of this merge pass (gate 2 only, no pre-fix-key gate) WRONGLY
  merged `matoya-archon-elder`'s own two genuinely-different `drawCard`
  facts (one anchored to its real "draw a card" clause, one to its own
  reminder-text parenthetical — a pre-existing, already-documented ambiguity
  the main dedup loop's own annotation-matching logic was specifically built
  to keep apart, see the `drawCard-effect-structural` wiring pass above).
  Caught via a direct before/after diff on that one file, reverted, and gate
  1 added specifically to prevent this class of mistake generically, not
  just patched for this one card.
- **Verification**: direct pool scan for remaining same-face
  `entersBattlefield`/`cast` duplicates → 0 (was 12). `matoya-archon-elder`
  re-confirmed to retag its real fact only, reminder-text fact untouched,
  matching its own long-documented expected shape exactly. 3 consecutive
  whole-pool runs: 1st retags/merges the real damage (13 facts merged
  pool-wide, since 2 of the 12 cards' own duplicate groups happened to
  include an extra distinct real fact alongside), 2nd+3rd are clean no-ops
  (idempotent, confirmed). `npx vitest run functional-model` 452/452 pass
  (unchanged). `npm run typecheck` — same 2 pre-existing baseline errors
  (`functional-model/mana.ts`, `server/api/tokens/by-key.ts`), 0 new.
  `verify-synergy.mjs` 0 hard failures pool-wide. `verify-annotation-
  coverage.mjs`/`verify-scenario-card-names.mjs` clean. `find-synergies.mjs`
  runs clean end-to-end.

**Not done, still open, unchanged from prior passes**: the Facts-tab
toggle/provenance UI, per-card review-scope narrowing, and the separate
"rule review" lane for auditing the recognizer catalog are all still not
designed/built. The CR-rule-citation Forge-verification caveat every
recognizer in this catalog already carries is unchanged by this pass either
(no new CR claims were introduced — this pass is pure plumbing around
existing recognizer verdicts).
