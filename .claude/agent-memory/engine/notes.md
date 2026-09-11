# engine agent notes

Scoped working memory for the `engine` specialist. Update before finishing
any task: decisions made, open questions, current state worth resuming
from. This is what makes a fresh respawn cheap — don't rely on transcript
resume alone (session transcripts are swept after ~30 days).

## Decisions

- **2026-09-11 (latest+17) — answered concretely: is `self-enters`'s
  `event:'entersBattlefield'` still doing anything now that it also has
  `to:'Battlefield'`? NO, fully inert for matching/rendering — traced
  every real consumer, didn't guess.** `factsInteract`'s shape-partition
  gate rejects it against both real event-shaped `entersBattlefield`
  sinks (Loporrit Scout, Woodland Weavemaster — both confirmed pure
  `{event:...}`, no zone fields) BEFORE the `event` string is ever
  compared — that gate, not a string mismatch, is why those 2 matches are
  lost. `describeFact`'s "enters the battlefield" label comes entirely
  from `zoneMovementName`'s `(from,to)` lookup, not from `event` — same
  for `themeOf`/`factKind`/`factConditions.ts`. Decision: KEEP the field
  anyway — real documentation of what the movement fundamentally is, and
  the exact lever a future matcher-unification pass would read to recover
  those 2 matches; removing it saves nothing today. Documented in both
  `synergy.ts`'s `Fact.event` doc comment and `SYNERGY_DESIGN.md`'s "Fact
  unification" section (no data/code/matching change, doc-only — verified
  234/234 vitest, 0 real tsc errors, unchanged).

- **2026-09-11 (latest+16) — MAJOR: `ZoneFact`/`EventFact` merged into ONE
  `Fact` interface, user-approved architecture shift.** `event`/`to`/
  `from` (and `zone`, folded into `to`) are now independent optional
  fields that freely co-occur — no more union, no more `isZoneFact`/
  `isEventFact` type-narrowing (both now plain `boolean` classifiers over
  the single `Fact` type). Scope: type/plumbing change is pool-wide-safe
  (nothing else touched or broken); only summon-bahamut's own data
  migrated.
  - `synergy.ts`: `ZoneFact`/`EventFact` interfaces removed, replaced by
    one `Fact` interface (full doc comment covers the merge rationale,
    ACT-vs-CONSEQUENCE rule, Stack-invisibility rule, deferred-matcher
    caveat). `ZoneFact`/`EventFact` kept as `export type ZoneFact = Fact;
    export type EventFact = Fact;` — deprecated back-compat ALIASES so
    `app/lib/factConditions.ts` (card-owned) and this file's own
    `synergy.test.ts` keep compiling with zero edits. `isZoneFact`/
    `isEventFact` — same runtime check (`'zone'||'to'||'from' in fact` /
    `'event' in fact`), just `boolean` return now, not a type predicate
    (there's no narrower type left to narrow to).
  - **Two real plumbing bugs found and fixed, not new matching
    semantics**: (1) `effectiveController` used to branch on `isZoneFact`
    to pick `subject` vs `target` — wrong once a merged fact can carry
    `target` with no `subject` while ALSO being zone-shaped (e.g.
    `self-cast`); fixed to check both unconditionally. (2)
    `factsInteract`'s zone-zone branch compared a sink's zone against a
    bare `w.zone` read instead of `effectiveZone(w)` — broke the moment a
    real sink (`mega-flare-you`) started authoring `to` instead of
    `zone`; same bug, same fix, ALSO existed independently in
    `scripts/verify-synergy.mjs`'s own JS-duplicate matcher (its sink
    checks only ever tested `'zone' in w`, never `'to' in w` — surfaced
    as 3 real hard failures on this card's own re-verification before
    the fix). `describeFact` also got a defensive fallthrough for a real
    NEW fact shape this merge introduces — `from`-only, no `to`
    (`self-cast`) — which has no "current zone" to render as a presence
    phrase; falls through to the `event`-named branches instead of
    crashing.
  - **`cards/summon-bahamut/synergy.json` migrated**: `self-graveyard`
    (ZoneFact) + `self-dies` (EventFact) — the same real occurrence
    represented twice — merged into ONE `dies` fact with real `from`/`to`
    AND `event`. `destroy-nonland`/`self-enters`/`self-cast` — `zoneFrom`/
    `zoneTo` simply renamed to `from`/`to` (no ZoneFact sibling to merge
    with). `destroy-act`/`self-sacrifice` unchanged (never had
    zoneFrom/zoneTo). Sink `mega-flare-you`: `zone:'Battlefield'` →
    `to:'Battlefield'`. `annotations-authoring.json` updated in lockstep
    (removed the now-merged-away `self-graveyard` positional slot, 10→9
    entries) — round-tripped byte-identical via `compute-annotations.mjs`.
  - **CAUGHT MY OWN BUG mid-task, via the required real diff — worth
    remembering the lesson, not just the fix**: first merged `self-dies`
    using `target:'self'` ONLY (dropped `subject:'self'`, reasoning
    "redundant, target already says self"). Real `find-synergies.mjs`
    before/after diff caught this as a SILENT, UNDOCUMENTED loss of 17
    real type-constrained zone-shaped matches (Ardyn the Usurper, Cloud
    of Darkness, Elixir, and 14 more) — `factsInteract`'s zone-matching
    branch ONLY ever reads `subject` (`resolveSubject`) to resolve a
    producer's real types for a type-constrained want, never `target`.
    Fixed by keeping BOTH `subject:'self'` AND `target:'self'` on the
    merged fact — a complete merge of two facts that each already
    declared self-reference (one via each field) should carry both
    forward, not arbitrarily drop one. This is "make the merge real," not
    "cleverly preserve matcher behavior" (the deferred/forbidden part) —
    re-ran the full diff again after the fix to confirm it actually
    restored exactly those 17, nothing more/less. **Lesson: run the real
    diff BEFORE writing up the design doc's numbers, not after — the
    first draft of both the doc and this notes file had wrong numbers
    (543→532/-11) that had to be corrected (543→549/+6) once the bug was
    caught.**
  - **Real pool-wide interactions diff, final/correct numbers** (fully
    reasoned and multiplicity-checked, not just raw line-diffed — see
    SYNERGY_DESIGN.md's "Fact unification" section for the full breakdown
    and every card name): Lost 14 lines (9 distinct real cards' own
    EventFact `event:'dies'` sinks, 3 double-counted since two different
    Bahamut facts each matched them before, + 2 real EventFact
    `event:'entersBattlefield'` sinks) — the accepted, expected
    shape-family regression. Gained 20 lines (9 real unconstrained
    zone-shaped Graveyard-presence sinks gaining a 2nd duplicate producer
    match, +10 genuinely NEW zone-shaped Battlefield-presence matches via
    `self-enters`, +1 new self-interaction via the `effectiveController`
    fix). Net 543→549 (+6). Confirmed via a temporary before/after file
    swap (reconstructed pre-task `synergy.ts`/`synergy.json`, ran
    `find-synergies.mjs`, restored real files, re-verified green) — a
    full-pool diff (not just Bahamut's own lines) confirmed ZERO
    collateral change to any other card.
  - Docs: `SYNERGY_DESIGN.md` — old "Two shapes, not one" bullet struck
    through and marked SUPERSEDED (not deleted — reasoning below it is
    still accurate), new "Fact unification" section added with the full
    before/after diff, the `subject`-drop bug-and-fix story, and future
    work (full matcher unification, letting one fact satisfy both
    shape-families' wants, explicitly NOT done this pass — tracked as
    open). `.claude/contracts/card-schema.md` — new bullet for `card`
    agent covering the merge, the `zone`→`to` sink rename, and that the
    Interactions panel for fin/1 will show different real matches (not a
    bug to fix on the card side).
  - Verified (final state): `npx vitest run functional-model` → 234/234
    (13 files; 3 obsolete `zoneFrom`/`zoneTo` tests rewritten to their
    real merged shapes); `verify-synergy.mjs` full pool → 313 checked, 1
    pre-existing unrelated hard failure (`auron-s-inspiration`); scoped →
    0 hard failures; `verify-annotation-coverage.mjs` → OK; `tsc --noEmit`
    → 0 real errors (down from the prior session's 45/58/60 — removing
    the `ZoneFact|EventFact` union actually FIXED a class of pre-existing
    `TS2353` "excess property check against a union" errors that had been
    tolerated for rounds, a genuine improvement, not just neutral).
  - **Open item, explicitly deferred per the task's own instruction, not
    a gap I introduced**: full matcher unification (letting one merged
    fact satisfy BOTH an event-shaped want and a zone-shaped want at
    once) is NOT done — `factsInteract` still hard-partitions on
    `isZoneFact`. If a future task wants to close the 14-line regression
    above for real, that's the redesign to do — don't attempt it via
    dual-classification tricks on individual facts (tried, rejected, same
    reasoning as the `moveZone`/fact-collapse rejections earlier this
    session).

- **2026-09-11 (latest+15) — real bug fix: `cards/summon-bahamut/
  scenarios.ts`'s two manual `pilot.log.push({fn:'enters', ...})` bystander
  entries (Ahriman, Coeurl) carried no `controller` field, so
  `scenarioReplay.ts`'s owner-guessing fallback (`guessOwner`, defaults to
  `'you'` for any unrecognized name) put BOTH on the player's own side —
  even though Coeurl is added via `pilot.state.addCard(pilot.opponents[0]!,
  ...)` and is supposed to be the opponent's own creature chapter I
  destroys.** Card-agent-found while fixing scenario-replay art; confirmed
  cosmetic-only (chapter I's real destroy-target logic reads real engine
  state, not the replay reconstruction) but real board-accuracy bug per
  this project's "real not mocked" replay standard.
  - Fix: added `controller: pilot.you.name` (Ahriman) / `controller:
    pilot.opponents[0]!.name` (Coeurl) to both pushes — exact field
    name/value convention already established elsewhere (checked
    `battle-menu`/`aerith-gainsborough`/`ambrosia-whiteheart`'s own
    scenarios.ts, all already use this same `controller: pilot.<x>.name`
    shape on their own manual `enters` pushes; `harness.ts`'s real
    engine-emitted `moveTo`/`destroy`/`putCounter` etc. all use the same
    `controller.getName()` convention on the engine side). `LogEntry` is a
    loose `{fn: string; [key: string]: unknown}` (harness.ts) so no type
    change needed.
  - Regenerated `trace.json` via `run-scenarios.mjs --slug=summon-bahamut`
    — diffed against a pre-change backup, confirmed the ONLY change is the
    2 new `"controller"` keys on the 2 `enters` entries, nothing else
    moved.
  - Verified LIVE via a scratch script calling the real
    `app/lib/scenarioReplay.ts`'s own `replayTrace` against the
    regenerated `trace.json`: Ahriman now resolves to `owner:'you'`,
    Coeurl now resolves to `owner:'opp0'` (and correctly shows up in
    `Graveyard` after chapter I's real destroy) — the actual reported bug
    confirmed fixed end-to-end, not just "should be fixed by inspection."
  - **Pool-wide sweep for the same gap — done, not deferred**: grepped
    every `functional-model/cards/*/scenarios.ts` and
    `functional-model/keywords/*/scenarios.ts` for `fn:'enters'` without
    `controller`. Found several more instances (adelbert-steiner,
    flying-reach, defender, deathtouch, first-strike-double-strike,
    vigilance-trample, menace) — but checked each one's own `addCard`
    call: EVERY one of them adds the bystander to `pilot.you`, never
    `pilot.opponents[...]`. Since `guessOwner`'s own default IS `'you'`,
    none of these are live bugs the way Coeurl's opponent-side omission
    was — cosmetically inert, not a reason to touch other cards' files
    this round. Cross-checked the OTHER direction too: every
    `addCard(pilot.opponents[0]!, ...)` bystander pool-wide (battle-menu,
    aerith-gainsborough, flying-reach ×2, menace ×2, vigilance-trample,
    deathtouch, first-strike-double-strike ×2) already DOES carry
    `controller: pilot.opponents[0]!.name` on its own `enters` push — this
    card was the only one with the gap on the actually-load-bearing
    (opponent) side. **Conclusion: not a systemic gap needing a follow-up
    sweep** — verified exhaustively, not assumed; scope stayed fin-1 by
    the check's own result, not by convention alone.
  - Verified: `npx vitest run functional-model` → 234/234;
    `verify-synergy.mjs` full pool → 313 checked, 1 pre-existing unrelated
    hard failure; scoped → 0 hard failures; `verify-annotation-coverage.mjs`
    → OK (this fix touches `scenarios.ts`/`trace.json`, not `synergy.json`,
    so annotations are untouched); `tsc --noEmit` → 60 errors, unchanged.

- **2026-09-11 (latest+14) — codified the ACT-vs-CONSEQUENCE
  `zoneFrom`/`zoneTo` distinction (implicit in the `self-cast`/`destroy-act`
  reasoning from latest+11/+8) as a NAMED standing rule, doc-only, no data
  change.** Rule: an ACT-type EventFact (`cast`/`destroy`/`sacrifice`) gets
  `zoneFrom`/`zoneTo` inline on itself only when the movement is a
  guaranteed, DEFINING part of the act (no "act happened but movement
  didn't" case exists — `cast`, CR 601.2a); it stays a bare tag deferring
  to a separate fact when the movement is conditional/preventable
  (`destroy` — indestructible/regeneration) OR already independently
  matched as its own concept (`sacrifice` defers to `self-graveyard`;
  `destroy` defers to `dies`). A CONSEQUENCE-type EventFact (`dies`,
  `entersBattlefield`) always gets the treatment for its fixed ends, since
  by the time it fires the movement is no longer conditional on anything —
  the conditionality lived upstream in whatever ACT may have caused it.
  - Added as a new named `####` subsection in `SYNERGY_DESIGN.md` (right
    after the `destroy-act` paragraph, before the `entersBattlefield`
    rename-rejection addendum) with a worked-examples table covering every
    real fact on this card: `self-cast` (inline, guaranteed), `destroy-act`
    (bare, conditional+separately-matched), `self-sacrifice` (bare,
    separately-matched via `self-graveyard`), `self-dies`/`destroy-nonland`
    (inline both ends, consequence), `self-enters` (inline `zoneTo` only,
    consequence — `zoneFrom` omitted for the separate Stack-invisibility
    reason, not this rule).
  - Added a compact pointer to the same rule + table in `synergy.ts`'s
    `EventFact.zoneFrom`/`.zoneTo` doc comment, right after the `destroy`
    bullet — so a future fact gets judged against the table instead of a
    fresh justification being invented each time.
  - Checked every EventFact on this card while writing the rule down —
    NO inconsistency found. `self-counters`/`chapter-iii-draw`/
    `chapter-iv-damage` aren't zone movements at all, so the
    `zoneFrom`/`zoneTo` question doesn't apply to them (correctly have
    neither field, for a reason outside this rule's scope).
  - No data change — confirmed via a full no-op verification pass:
    `npx vitest run functional-model` → 234/234; `verify-synergy.mjs` full
    pool → 313 checked, 1 pre-existing unrelated hard failure;
    `verify-annotation-coverage.mjs` → OK; `tsc --noEmit` → 60 errors,
    unchanged from the prior round.

- **2026-09-11 (latest+13) — evaluated and REJECTED renaming
  `event:'entersBattlefield'` to a generic `event:'zoneChange'`** (the same
  `moveZone`-style redundancy argument already applied to `dies`, now
  raised for `entersBattlefield` since it too carries its own `zoneTo`).
  Redid the due-diligence check independently, not assumed from the `dies`
  precedent: `grep`'d every `cards/*/synergy.json` — 16 real cards declare
  `event:'entersBattlefield'` (14 SOURCE producers, 2 SINK wants:
  loporrit-scout, woodland-weavemaster). Ran `find-synergies.mjs` against
  the real pool and confirmed all 14 producers — including Summon:
  Bahamut's own `self-enters` — produce real `--[enters the
  battlefield]-->` edges into both sinks today. Renaming Bahamut's own
  event string would silently drop those 2 real matches — same regression
  class as the already-rejected `dies`→`moveZone` rename. Verdict: KEEP
  `entersBattlefield` as-is, same reasoning as `dies` (established,
  actively-matched pool vocabulary + a real CR-defined term, CR
  110.5/603.6) — `zoneFrom`/`zoneTo` already deliver the self-explaining-
  data goal without touching the matched name.
  - No rename happened, so the follow-up ("should `dies` retroactively get
    the same verdict?") doesn't arise here — both event names were
    independently checked and independently kept on their own real
    pool-usage merits, not by transferring one verdict to the other.
  - No data/code change this round — `synergy.json` untouched. Added the
    check + reasoning to `SYNERGY_DESIGN.md`'s "`EventFact.zoneFrom`/
    `.zoneTo`" section as a new "considered and rejected" addendum,
    right after the existing `dies`→`moveZone` one.
  - Verified (no-op confirmation, nothing changed): `npx vitest run
    functional-model` → 234/234; `verify-synergy.mjs` full pool → 313
    checked, 1 pre-existing unrelated hard failure; scoped → 0 hard
    failures; `verify-annotation-coverage.mjs` → OK; `tsc --noEmit` → 60
    errors, unchanged from the prior round's count.

- **2026-09-11 (latest+12) — new `EventFact.targeted?: boolean` field**
  (user-approved, generalized): distinguishes a real CR 601.2c targeted
  choice from an unconditional broadcast, for a fact whose
  `target`/`recipient` names a real bucket of more-than-one candidate.
  - `synergy.ts`: added the field + doc comment right after `recipient`.
    Convention: only ever written (`true` or explicit `false`) when the
    axis is meaningful; omitted (not `false`) when the fact's only real
    subject is `'self'`/singular `you` — omission there means "not
    applicable," not "unreviewed."
  - `cards/summon-bahamut/synergy.json`: `destroy-act`/`destroy-nonland` →
    `targeted:true` (oracle: "Destroy up to one target nonland
    permanent" — real CR-targeting language, checked against
    `annotations-authoring.json`'s own stored source text); `chapter-iv-
    damage` → `targeted:false` (oracle: "...to each opponent" — no choice,
    checked same way). Did a full per-fact pass over every OTHER EventFact
    on the card (`self-cast`, `self-enters`, `self-dies`, `self-sacrifice`,
    `self-counters`, `chapter-iii-draw`) — all omit it: each has only
    `target:'self'` or singular `controller:'you'`, no real bucket of
    candidates to have chosen among or broadcast to.
  - Purely informational: NOT consulted by `factsInteract` (verified via a
    new permanent test — a `targeted:false` want still matches a
    `targeted:true` produce of the same event), and deliberately NOT added
    to `themeOf` (same treatment as `zoneFrom`/`zoneTo`, which also aren't
    in `themeOf` — that function is scoped to attributes a fact actually
    constrains for matching).
  - Updated `SYNERGY_DESIGN.md` (new "`EventFact.targeted`" section) and
    `.claude/contracts/card-schema.md` (new bullet, flagged for `card`
    agent: will appear on served summon-bahamut facts, same
    allowlist-doesn't-choke-on-it check as `zoneFrom`/`zoneTo`, no
    rendering required yet).
  - Verified: `npx vitest run functional-model` → 234/234 (13 files, +1
    new test); `compute-annotations.mjs summon-bahamut` round-trip
    byte-identical; `verify-synergy.mjs` full pool → 313 checked, 1
    pre-existing unrelated hard failure (`auron-s-inspiration`); scoped →
    0 hard failures; `verify-annotation-coverage.mjs` → OK (this change
    doesn't touch `annotations` at all). `tsc --noEmit` → 60 errors, +2
    from the 58 baseline — confirmed these are 2 MORE instances of an
    already-present, already-tolerated `TS2353` "excess property check
    against a `satisfies Omit<Fact,'role'>` union" quirk (identical
    message already occurs at 6 other lines in this same test file, e.g.
    lines 208/209/217/218/225/226) from my new test's own literal
    fixtures — not a new error class, not a real type-safety gap.

- **2026-09-11 (latest+11) — corrected latest+10's `self-cast` conclusion
  after coordinator/user generalized the rule: Stack is the ONE zone this
  model never assigns as a `zoneFrom`/`zoneTo` value (invisible/
  skip-through); every other real zone (Battlefield, Graveyard, Hand,
  Library, Exile, Command, ...) is fair game whenever actually known — the
  earlier framing ("cast has no zone worth tracking since Stack has no
  pool precedent") wrongly let Stack's invisibility on ONE end blank out
  the OTHER end too.**
  - `self-cast` now `{event:'cast', zoneFrom:'Hand', target:'self',
    value:-1, annotations:[...]}` — checked `definition.ts` first (no
    alternate-cost/flashback/foretell wrinkle on Summon: Bahamut, so its
    own cast really does originate in Hand); `zoneTo` still omitted, but
    for the corrected reason (real destination IS the Stack, the
    deliberately-invisible zone — not "unknown").
  - Also corrected the REASONING (not the outcome, which was already
    right) for `self-enters`'s omitted `zoneFrom`: it's not "unknown among
    hand/library/whatever, so we don't know" — the common-case real
    predecessor zone for entering via a normal cast is the Stack itself
    (invisible, correctly never written), and other real entrance effects
    (tutor/blink/token) have other real non-Stack origins that genuinely
    vary. Both reasons independently justify omitting it; get the
    reasoning right for the next fact that needs this call.
  - Re-checked `destroy-act` under the same pass — confirmed correctly
    unaffected, but for an UNRELATED reason: CR 701.6 destroying isn't a
    guaranteed movement (regeneration/indestructible can prevent it), so
    it stays a bare ACT tag regardless of the Stack rule; `destroy` doesn't
    touch the Stack at all anyway.
  - Wrote the generalized rule explicitly into `synergy.ts`'s
    `EventFact.zoneFrom`/`.zoneTo` doc comment and into
    `SYNERGY_DESIGN.md`'s "`EventFact.zoneFrom`/`.zoneTo`" section (as a
    dated correction addendum, not a silent rewrite of the earlier
    now-wrong reasoning).
  - Added a permanent regression test for `cast` + `zoneFrom:'Hand'` to
    `synergy.test.ts` (mirrors the existing `dies`/`entersBattlefield`
    tests) — verified `isZoneFact`/`isEventFact`/`describeFact` all still
    behave correctly.
  - Verified: `npx vitest run functional-model` → 233/233 (13 files, +1
    new test); `verify-synergy.mjs` full pool → 313 checked, 1
    pre-existing hard failure (`auron-s-inspiration`, unrelated); scoped →
    0 hard failures; `verify-annotation-coverage.mjs` → OK; `tsc --noEmit`
    → 58 errors, unchanged baseline. `compute-annotations.mjs
    summon-bahamut` round-trip confirmed byte-identical (the `zoneFrom`
    addition doesn't touch annotation text/highlight).
  - No open Forge-verification needed — rests on CR 601/700.4/701.6 plus
    `definition.ts` (no alternate-cost wrinkle) and a pool-wide grep (zero
    `"Stack"` zone values anywhere), not Forge-specific behavior.

- **2026-09-11 (latest+10) — extended the `zoneFrom`/`zoneTo` treatment
  (latest+8, below) to `self-enters` (`event:'entersBattlefield'`); reviewed
  `self-cast` (`event:'cast'`) for the same and left it unchanged
  (SUPERSEDED — see latest+11 above, this conclusion on `self-cast` was
  wrong).**
  - `cards/summon-bahamut/synergy.json`: `self-enters` now
    `{event:'entersBattlefield', zoneTo:'Battlefield', target:'self',
    value:-1, annotations:[...]}` — `zoneFrom` deliberately OMITTED (not
    forgotten): destination is fixed (`'Battlefield'`, it's in the event
    name) but real origin varies per effect (hand/library/exile/command
    zone/nowhere-for-a-token) — same "omitted = unknown/any origin"
    convention `ZoneFact.from` already uses, not a new rule.
  - `self-cast` left as a bare `{event:'cast', target:'self', value:-1}` —
    NO `zoneFrom`/`zoneTo` added. Two independent reasons: (1) casting is a
    CR 601 ACT, same category as `destroy-act`/`self-sacrifice` (already
    bare event tags, left that way on purpose) — not a consequence that
    structurally always resolves to a fixed real zone; (2) even setting
    that aside, `cast`'s "destination" is CR 601.2i's "the stack", and a
    real pool grep (`grep -rl '"zone": "Stack"\|"to":
    "Stack"\|"from": "Stack"' cards/*/synergy.json`) returned ZERO hits —
    no fact anywhere in this model has ever used a `Stack` zone value;
    adding one here would be precedent-free vocabulary with no real
    matching value, not filling a genuine gap. If a real future card needs
    to match "cast from a specific zone" (flashback/foretell/etc.), design
    real `Stack` vocabulary deliberately then — don't bolt it onto
    `self-cast` as unused decoration now.
  - Added a permanent regression test to `synergy.test.ts` for
    `entersBattlefield` + `zoneTo` (mirrors the existing `dies` +
    `zoneFrom`/`zoneTo` test) — verified `isZoneFact`/`isEventFact`/
    `describeFact` all still behave correctly (structural discriminator
    unaffected, same as the `dies` case).
  - Updated `synergy.ts`'s `EventFact.zoneFrom`/`.zoneTo` doc comment and
    `SYNERGY_DESIGN.md`'s "`EventFact.zoneFrom`/`.zoneTo`" section to cover
    both cases and the `self-cast` reasoning.
  - Verified: `npx vitest run functional-model` → 232/232 (13 files);
    `verify-synergy.mjs` full pool → 313 checked, 1 pre-existing hard
    failure (`auron-s-inspiration`, unrelated); `summon-bahamut`-scoped →
    0 hard failures; `tsc --noEmit` → 58 errors, unchanged baseline.
  - No open Forge-verification needed for this round — both decisions rest
    on CR text (601, 700.4) plus real pool/code checks already done, not on
    Forge card-script behavior.

- **2026-09-11 (latest+9) — removed `mega-flare-opp` (SINK,
  `zone:'Battlefield', controller:'opp'`) from `cards/summon-bahamut/
  synergy.json` — spurious, same bug class as the earlier `self-battlefield`
  removal (a fact anchored to real text that doesn't actually support what
  it claims to want).** Coordinator/user's own reading, VERIFIED (not just
  trusted) against the actual ability logic before removing, per the
  standing "check before deleting" discipline:
  - **`definition.ts`'s chapter IV effect** computes `amount` via
    `ctx.you.getCardsIn('Battlefield').reduce(...)` — reads ONLY the
    controller's OWN battlefield, never the opponent's. The real oracle
    text's "to each opponent" names the damage's RECIPIENT (a player), not
    a scaling dependency on the opponent's board — confirmed by reading the
    live effect code, not just re-parsing the English sentence.
  - **Independently confirmed via a real pool run, not just the code
    read**: ran `findInteractionsForCard('Summon: Bahamut', pool)` against
    the actual 320-card pool — `mega-flare-you` (`controller:'you'`)
    produced 192 real matches; `mega-flare-opp` produced ZERO (its own
    group is silently dropped by `matchOne`'s `if (!matches.length) return
    null`, so it never even showed up in `findInteractionsForCard`'s own
    output) — this fact wasn't just textually ungrounded, it was already
    fully inert in the live pool, unlike `self-battlefield` (which DID
    generate ~130 real matches despite being conceptually wrong — a
    reminder that "produces real matches" and "is a correct fact" are
    independent checks, not substitutes for each other).
  - No scenario/test/script referenced `mega-flare-opp` by name anywhere
    (checked via grep — `Fact.id` is gone, so nothing COULD reference it by
    a literal id either).
  - `cards/summon-bahamut/synergy.json`: removed the sink entirely (2 sink
    facts → 1). `annotations-authoring.json`: removed the corresponding
    POSITIONAL sink entry (index 1) in lockstep — critical since the two
    files are index-aligned, not id-keyed (removing from only one would
    have silently misaligned `mega-flare-you`'s own authoring entry against
    nothing, or worse, silently authored the WRONG fact). Verified the
    round-trip is still correct after the removal: re-ran
    `compute-annotations.mjs summon-bahamut`, diffed against a pre-removal
    backup — byte-identical (11 facts total, 10 source + 1 sink).
  - Verified: `npx vitest run functional-model` → 231/231 (no test
    referenced this fact, none needed updating). `npx vite-node
    functional-model/scripts/verify-synergy.mjs` (full pool) → 313 checked,
    1 hard failure — still only the pre-existing, unrelated
    `auron-s-inspiration`; zero annotation violations. `summon-bahamut`
    -scoped run → 0 hard failures (only pre-existing `tapForMana` soft
    notes) — removing a SINK fact can't create a produce/evidence gap, so
    this was expected, confirmed anyway. `npx tsc --noEmit -p
    functional-model/tsconfig.json` → 58 errors, unchanged.
  - **Open Forge-verification**: none — pure fact-authoring correction
    (removing a fact with no real mechanical basis), no `harness.ts`/
    `interfaces.ts`/rules-engine behavior touched; the `definition.ts` read
    that grounded this decision was of ALREADY-existing, unchanged code.

- **2026-09-11 (latest+8) — same-batch follow-up to `latest+7` below: added
  `EventFact.zoneFrom`/`.zoneTo` (purely descriptive) to `self-dies`/
  `destroy-nonland` on summon-bahamut, so all three "something dies" facts
  (those two plus the ZoneFact `self-graveyard`) carry matching, self-
  explaining zone data instead of two different encodings of the same real
  thing.** User's original ask offered `event: 'moveZone'` as one possible
  fix — evaluated and REJECTED that specific part (see reasoning below);
  implemented the from/to-data half of the ask instead.
  - **The real constraint that shaped this**: `isZoneFact` discriminates
    STRUCTURALLY (`'zone' in fact || 'to' in fact || 'from' in fact`), not
    by a type tag — so literally reusing `ZoneFact`'s own `from`/`to` field
    names on an EventFact would make it misclassify as a ZoneFact, breaking
    the documented "never both" invariant AND silently routing it through
    `describeFact`'s zone-movement branch instead of its event branch.
    Used differently-named fields (`zoneFrom`/`zoneTo`) specifically to
    avoid this — verified EMPIRICALLY, not just reasoned about (a real
    `isZoneFact`/`isEventFact`/`describeFact` call against a fact literal
    carrying both `event` and `zoneFrom`/`zoneTo`, and against the real
    regenerated Bahamut facts themselves): both `event:'dies'` facts still
    classify as `isEventFact` (not `isZoneFact`) and still render bare
    "dying". New permanent regression test added
    (`synergy.test.ts`, "dies with `zoneFrom`/`zoneTo`... still classifies
    as an EVENT fact").
  - **Rejected `event: 'moveZone'` rename, with a concrete reason, not just
    aesthetic preference**: `event: 'dies'` is itself established, actively
    -matched pool vocabulary — 11 real cards' own EventFact sinks declare
    `event:'dies'` today (checked via a real pool grep: al-bhed-salvagers,
    jenova-ancient-calamity, judge-magister-gabranth,
    sephiroth-fabled-soldier, sephiroth-planet-s-heir, undercity-dire-rat,
    vincent-valentine-galian-beast, zodiark-umbral-god, plus
    aerith-gainsborough/dwarven-castle-guard/magic-pot's own
    `target:'self'`-scoped ones). Renaming Bahamut's own producer event
    string would have silently broken every one of those real matches
    while every other card's own sink kept expecting `'dies'` — a real
    regression the task's own explicit "don't silently change matching
    semantics without saying so" caution was checking for. Confirmed this
    is a real, checkable cost, not a hypothetical one, before rejecting it.
  - **Also checked and rejected collapsing `self-graveyard`
    (ZoneFact)/the two `dies`-shaped EventFacts into fewer facts**, now
    that they'd carry matching from/to data — `factsInteract` requires
    both sides of a match to share the SAME shape
    (`isZoneFact(p) !== isZoneFact(w)` → no match), so a real pool sweep
    confirms both shapes are independently load-bearing: 30+ real cards'
    own ZONE-shaped `zone:'Graveyard'` sinks can only ever match a
    ZONE-shaped produce (`self-graveyard`), and the 11 EVENT-shaped
    `event:'dies'` sinks above can only ever match an EVENT-shaped
    produce (`self-dies`/`destroy-nonland`). Collapsing to one shape
    would silently drop real matches on whichever side lost its shape —
    not redundant, despite now carrying the same from/to DATA.
  - `destroy-act` (`event:'destroy'`, the ACT, CR 701.6) deliberately did
    NOT get `zoneFrom`/`zoneTo` — same reasoning `self-sacrifice`
    (`event:'sacrifice'`, also an ACT) already doesn't have them: an ACT
    fact isn't itself the movement, its paired dies-CONSEQUENCE fact is
    (which already carries the descriptive zone data) — adding it to the
    act too would be the exact "two different encodings of the same real
    thing" duplication this whole correction is trying to eliminate, just
    shifted one fact over.
  - `synergy.ts`: new `EventFact.zoneFrom?`/`.zoneTo?: string` fields
    (doc'd at length on the field itself with the misclassification
    warning), a matching doc-comment addition on `isZoneFact` itself
    warning against ever widening it to include these, and an explicit
    comment in `factsInteract`'s EventFact branch confirming they're
    never compared. `SYNERGY_DESIGN.md` — new "`EventFact.zoneFrom`/
    `.zoneTo`" subsection covering all of the above (including both
    rejected alternatives and why). `.claude/contracts/card-schema.md` —
    new bullet flagging the fields for `card` agent (`factConditions.ts`'s
    own `HANDLED_OR_LABEL_KEYS`-style allowlist should account for them
    sensibly, not show them as a mystery field) — not fixed here, out of
    lane.
  - `cards/summon-bahamut/synergy.json`: added `zoneFrom:'Battlefield',
    zoneTo:'Graveyard'` to both `destroy-nonland` and `self-dies`. No
    change to `self-graveyard` (already had real `from`/`to`), no change
    to `destroy-act`/`self-sacrifice` (ACTS, not movements, per above).
    No `annotations-authoring.json`/`annotations` changes needed — these
    are new semantic fields, not textual-anchor fields, so annotation
    computation/indexing is untouched.
  - Verified: `npx vitest run functional-model` → 231/231 (13 files, +1 new
    test). `npx vite-node functional-model/scripts/verify-synergy.mjs`
    (full pool) → 313 checked, 1 hard failure — confirmed still only the
    pre-existing, unrelated `auron-s-inspiration`; zero annotation
    violations. `summon-bahamut`-scoped run → 0 hard failures (only
    pre-existing `tapForMana` soft notes) — confirms the new fields don't
    trip `verify-synergy.mjs`'s own event-evidence check (which only ever
    compares `p.event === ev.event`, ignoring the new fields entirely,
    same as any other extra JS object property). `npx tsc --noEmit -p
    functional-model/tsconfig.json` → 58 errors, unchanged from the
    `latest+7` baseline.
  - **Open Forge-verification**: none — descriptive-field addition +
    reasoning about existing matcher semantics, no `harness.ts`/
    `interfaces.ts`/rules-engine behavior touched. CR 700.4/701.6 citations
    are rules-vocabulary justification for the act-vs-consequence field
    placement, already-established earlier today, not new claims.

- **2026-09-11 (latest+7) — same-batch follow-up to `latest+6` below (four
  more mid-task corrections relayed by the coordinator, all folded into one
  coherent regen/verification rather than four separate passes): made
  `Fact.annotations` REQUIRED (min. one entry), added a new
  `AnnotationRef.target: 'typeLine'` variant, deleted `self-battlefield`
  outright, and moved `sourceText`/`highlight`/`anchor` OFF the served
  `Fact` entirely into a new per-card `annotations-authoring.json`. Also
  confirms the sacrifice/dies fact shapes are already correct (no fix
  needed there). Supersedes `latest+6`'s own `factIdentity()` formula (it
  used `fact.sourceText`, which no longer exists) — read this entry, not
  that one, for the CURRENT identity convention.
  - **Per-fact annotation decisions on `cards/summon-bahamut/synergy.json`**
    (the "every fact needs a real annotation" invariant forced a real
    per-fact judgment call, not a mechanical fix):
    - `self-cast` (`event:'cast'`), `self-enters` (`event:'entersBattlefield'`)
      — RE-ANCHORED to the card's own real TYPE LINE (`"Enchantment
      Creature — Saga Dragon"`), not the oracle text body — genuinely real,
      non-fabricated anchors (the printed type line, not invented text):
      `self-cast` highlights `"Creature"` (licenses "cast AS A CREATURE
      spell" specifically), `self-enters` highlights `"Enchantment
      Creature"` (licenses "IS A PERMANENT," the precondition for
      entering the battlefield at all — deliberately not narrowed to just
      "Creature" since either printed type would equally license this).
      This is the exact "something in the pool actually needs it" case
      that justified adding `AnnotationRef.target:'typeLine'` (previously
      speculatively avoided) — old `sourceText`s here were parenthetical
      glosses ("(baseline — ... is itself cast as a creature spell, like
      any other permanent).") that were NEVER real oracle text, which is
      exactly why they'd never had annotations at all.
    - `self-dies` (`event:'dies'`, target self) — RE-ANCHORED to real
      oracle text: `sourceText`/`highlight` changed to `"Sacrifice after
      IV."` (same span `self-graveyard`/`self-sacrifice` already
      use) — its old parenthetical gloss ("(baseline — the real 704.5x
      sacrifice after chapter IV is still Bahamut dying, whatever the
      cause)") was also never real text; the REAL textual basis for "this
      creature dies" is the printed sacrifice instruction itself (dying IS
      the direct, sole cause here — no separate combat/removal path exists
      on this card), so re-pointing at that real line is not a stretch,
      it's the actual justification finally made explicit.
    - `self-counters` (`event:'putCounter'`) — its `sourceText` was
      ALREADY 100% real, verbatim oracle text (Saga reminder text, line 0:
      `"(As this Saga enters and after your draw step, add a lore
      counter. Sacrifice after IV.)"` — Saga reminder text is genuinely
      printed on the card, not a gloss) — it simply never had a
      `highlight` authored, so `computeFactAnnotations` had nothing to
      slice. Added `highlight: "add a lore counter"` (verbatim substring)
      — no re-anchoring needed, just filling in the missing piece.
    - `self-battlefield` (`zone:'Battlefield'`, presence-with-Flying) —
      **DELETED OUTRIGHT**, not re-anchored, per a SEPARATE, firmer
      correction mid-task: a SOURCE fact must never describe bare
      presence ("sits in this zone"), only a real zone TRANSITION — this
      fact was pure presence (exists only so a hypothetical "you control
      a flying creature" sink could match it; Bahamut doesn't arrive
      anywhere via this fact, it just... has Flying, forever, while on
      the battlefield). This is the SAME rule `self-battlefield` was
      already flagged against once earlier today (reverted from a fake
      `to:'Battlefield'` movement back to bare presence to fix a
      duplicate-label bug) — the right fix was always removal, now done.
      **Checked for a real dependency before deleting** (per the task's
      own explicit "flag back, don't delete blind" instruction): no other
      fact ON THIS CARD, no scenario, no `verify-synergy.mjs` check, and
      no vitest test references it; the only real effect is Bahamut
      losing its own presence in the pool's generic, unqualified
      "battlefield presence" match set (confirmed via a real
      `find-synergies.mjs summon-bahamut` run before deleting — ~130
      OTHER cards' own bare `{zone:'Battlefield'}` sink facts had matched
      it) — this is the deliberate, ALREADY-ANTICIPATED consequence of
      enforcing the rule on this card (the whole POOL still has this same
      bare-presence-SOURCE shape on every other unmigrated card, untouched
      — a much bigger, explicitly out-of-scope cross-cutting migration,
      not a Bahamut-specific dependency worth blocking on). Fact count:
      13 → 12 (11 source → 10).
  - **`AnnotationRef` widened to a real union** (`{target:'oracle',
    line,start,end} | {target:'typeLine',start,end}` — no `line` on the
    `typeLine` variant, a type line has no paragraph structure to index).
    `computeFactAnnotations`/`rawHighlightRange` (`synergy.ts`) reworked to
    branch on this and to take a `texts: {oracle?, typeLine?}` bag instead
    of a single string.
  - **`Fact.annotations` is now `[AnnotationRef, ...AnnotationRef[]]`**
    (TS non-empty-tuple idiom — no runtime array-length keyword exists),
    not `AnnotationRef[] | undefined`. New enforcement, mirroring the
    `scenario-card-names.mjs` three-file shape exactly: `scripts/
    annotation-coverage.mjs` (shared logic — `ANNOTATED_CARD_SLUGS`
    allowlist, today just `summon-bahamut`; `findMissingAnnotationsInSynergy`
    pure/no-I/O for direct unit testing, `findMissingAnnotations` the real
    file-reading sweep), `scripts/verify-annotation-coverage.mjs` (CLI
    wrapper), `annotation-coverage.test.ts` (top-level, wired into `npm run
    test`, 5 new tests: 3 exercise the checker's own logic directly against
    synthetic fixtures — INCLUDING a real "flags a fact with annotations
    entirely absent" case, i.e. actually proven to have teeth, not just
    passing against an already-clean pool — 2 exercise the real pool).
    Wired into `verify-synergy.mjs`'s own combined exit code the same way
    the scenario-name check already is (`ANNOTATED_CARD_SLUGS`
    slug-filtered by `requested` the same way).
    **Verified the check has real teeth END TO END, not just via its own
    unit tests**: temporarily deleted one real annotation from the
    checked-in `cards/summon-bahamut/synergy.json`, ran `verify-synergy.mjs
    summon-bahamut` for real — got a genuine nonzero exit (checked `$?`
    directly off the process, not through a pipe/tail, learned from an
    earlier session's own documented mistake) and the correct violation
    line printed, then restored the file from a backup and re-confirmed
    exit 0 clean.
  - **`sourceText`/`highlight`/`anchor` removed from the served `ZoneFact`/
    `EventFact` shape entirely** — a separate, later mid-task correction:
    once `annotations` is a required, real pointer, the literal text is
    fully re-derivable by slicing `oracleText`/`typeLine` at that pointer,
    so keeping the authored string ALSO on the served object is pure
    duplication (this session's running "facts should be as short as
    possible" theme, restated explicitly by the user this time). New
    types in `synergy.ts`: `FactAnnotationAuthoring` (`{anchor?,
    sourceText, highlight}`) and `AnnotationAuthoringFile` (`{source:
    (FactAnnotationAuthoring|null)[], sink: (...)[]}`) — POSITIONALLY
    aligned with `synergy.json`'s own `source`/`sink` arrays (index-based,
    not id-keyed, since `Fact.id` is gone too — reorder both together or
    they silently misalign; documented prominently on the type itself).
    Lives in a new `cards/<slug>/annotations-authoring.json`, checked into
    git (so the authored intent isn't lost — still needed to regenerate
    `annotations` later if oracle text or the matching logic changes),
    read ONLY by `scripts/compute-annotations.mjs` — never by
    `find-synergies.mjs`/`verify-synergy.mjs` (confirmed via grep neither
    ever read `sourceText`/`highlight` in the first place, so this move is
    zero-impact on matching/reconciliation) and never served.
    - `compute-annotations.mjs` rewritten to read BOTH files per card
      (`synergy.json` for the real semantic facts + `annotations-authoring
      .json` for the per-index authoring entry), zip them by array index,
      compute, and write `annotations` back into ONLY `synergy.json`
      (the authoring file is never written back to by this script — a
      human/AI edits it directly when re-authoring is needed).
    - `computeFactAnnotations(texts, fact)` → `computeFactAnnotations(texts,
      authoring)` — now takes a `FactAnnotationAuthoring | null | undefined`
      instead of reading `sourceText`/`highlight`/`anchor` off a `Fact`
      object; `rawHighlightRange` similarly retyped.
    - `factIdentity()` (the `Fact.id` replacement from `latest+6`) COULD NOT
      keep using `sourceText` (now gone) — redesigned to `` `${fact.role}::
      ${describeFact(fact)}::${JSON.stringify(fact.annotations[0])}` ``.
      Arguably a STRICTLY BETTER identity than the old `sourceText`-based
      one: `annotations[0]` is now guaranteed present (required field) and
      exact-position-precise, vs. `sourceText` being merely a same-string
      coincidence check. **This changes what `card` agent's own `factKey()`
      needs to be** — the guidance in the `latest+6` entry/the
      `card-schema.md` contract as of THIS entry both point at the new
      tuple; don't use the older `role::sourceText::describeFact` formula
      documented in `latest+6`, it's stale as of this entry.
    - `cards/summon-bahamut/annotations-authoring.json` created (10 source +
      2 sink entries, positionally matching the post-`self-battlefield`
      -deletion `synergy.json`). `synergy.json` itself had `sourceText`/
      `highlight`/`anchor` stripped from every fact via a one-off Node
      script (not hand-edited) — kept only semantic fields + `annotations`.
      **Verified the round-trip is real, not assumed**: backed up the
      already-annotated `synergy.json`, stripped the three fields, wrote
      the new authoring file, re-ran `compute-annotations.mjs`, diffed the
      regenerated file against the backup — byte-identical.
  - **Confirmed, not re-fixed (coordinator asked for explicit confirmation
    given a user complaint "there is no from and to in sacrifice")**: three
    facts represent Bahamut dying/being sacrificed on the current
    `synergy.json` — `self-graveyard` (`ZoneFact`,
    `from:'Battlefield',to:'Graveyard'`, subject self — the DYING
    consequence, lets another card's plain `zone:'Graveyard'` sink match
    it), `self-sacrifice` (`EventFact`, `event:'sacrifice'`, target self —
    the ACT itself, no from/to at all, EventFacts never carry zone fields
    in this schema), `self-dies` (`EventFact`, `event:'dies'`, target self
    — the CR 700.4 consequence-as-an-event, also no from/to). **Only
    `self-graveyard` carries `from`/`to`, and it's a genuine, deliberate
    zone-movement fact, not presence in disguise** — CR 701.20a's own
    text: "To sacrifice a permanent, its controller moves it from the
    battlefield to its owner's graveyard" literally describes a
    battlefield→graveyard transition, the exact same category the
    pre-existing 2026-09-11 "SOURCE ZoneFact reworked" design already cites
    CR 700.4 for. This is NOT the same violation category as
    `self-battlefield` (which was presence-with-a-property, no arrival/
    departure at all) — a sacrifice-caused zone change genuinely IS an
    arrival (at the graveyard) with a well-defined origin (the
    battlefield), which is precisely what `from`/`to` exists to express.
    Left the DATA/shape unchanged. **Follow-up naming correction, same
    batch**: the coordinator relayed a second, narrower objection to how
    I'd been REFERRING to this fact in prose — I'd been calling it
    "self-sacrifice-graveyard" (its literal `id` before `Fact.id` was
    removed earlier this same task), which the user correctly read as
    conflating "dying" (what this fact actually represents) with
    "sacrifice" (a different fact, `self-sacrifice`, entirely) — the same
    act-vs-consequence split `destroy-act`/its own dies-consequence fact
    already keep separate for the destroy case. Checked: the actual DATA
    has no name/id field to rename (already removed), and no script/JSON
    conflates the two either (`compute-annotations.mjs`,
    `annotations-authoring.json` are purely positional, no names at all)
    — this was PURELY my own prose/comment naming, not a real data/code
    bug. Fixed the live (non-historical) references: `synergy.test.ts`'s
    own `describeFact` test description (also dropped a second, unrelated
    stale citation of the deleted `self-battlefield` fact in the adjacent
    test while there), and a `verify-synergy.mjs` code comment explaining
    the `sacrifice` fn's two-events shape — both now say `self-graveyard`
    and spell out the dying-vs-sacrifice distinction explicitly.
    Deliberately did NOT rewrite older, already-historical entries in this
    same notes.md file or in `SYNERGY_DESIGN.md`'s own dated "Correction"
    addenda that still say "self-sacrifice-graveyard" — those are accurate
    records of what the fact was literally CALLED at the time (before
    `Fact.id` removal), rewriting them would be revisionist, not a
    naming fix. `.claude/agent-memory/card/notes.md` also has several
    "self-sacrifice-graveyard" references — not mine to edit (another
    agent's memory), flagged for `card` agent instead. Happy to revisit
    the underlying `self-graveyard`/`self-sacrifice`/`self-dies` shape
    itself with a more specific pointer if this analysis is missing
    something, but as of this entry the DATA was already conceptually
    correct — only the prose naming needed the fix.
  - **Docs updated**: `SYNERGY_DESIGN.md` — new "No `id`, no `sourceText`/
    `highlight` on the served fact — `annotations` required" subsection
    under "The fact model" covering all of the above in one place (not
    duplicating `latest+6`'s already-superseded framing).
    `.claude/contracts/card-schema.md`'s "Fact-to-oracle-text pointers"
    section rewritten (the `latest+6`-era paragraph about `Fact.id` there
    is now itself superseded — replaced, not left stale) with the full
    current shape and a complete, updated card-agent action-item list.
  - **Full app/server call-site list for `card` agent, current as of THIS
    entry (supersedes the shorter `latest+6` list)**:
    - `app/components/FunctionalModelText.vue:66` — `factKey()`:
      `` return f.id ?? `${f.role}::${f.sourceText}::${describeFact(f)}`; ``
      — replace entirely with the new tuple (`f.role`, `describeFact(f)`,
      `f.annotations[0]` stringified) — NEITHER `f.id` NOR `f.sourceText`
      exist anymore.
    - `app/pages/app/card/[set]/[number].vue:285` — page's own `factKey()`,
      identical old shape, same fix.
    - `app/pages/app/card/[set]/[number].vue:331` — `openFactDebugModal`:
      `` `Fact JSON — ${fact.id ?? factKey(fact)}` `` → just `factKey(fact)`.
    - `app/pages/app/card/[set]/[number].vue:919` — Facts-table row hover
      `:title="row.fact.sourceText"` — NEW this entry (`sourceText` didn't
      exist as a served-field concern before today) — needs to derive the
      same full-sentence hover text from `oracleText` + the fact's own
      first `annotations` entry instead (slice the whole line for an
      `'oracle'`-targeted annotation, or the whole `typeLine` string for a
      `'typeLine'`-targeted one).
    - `server/api/graph-links.ts:93` — `` `${name}::${group.fact.id ??
      group.description}` `` — reads `.id` directly off a `Fact`, will fail
      to type-check now; same tuple swap (or just drop to
      `group.description` alone, already the existing `??` fallback).
    - `app/lib/graphRenderer.ts:81` — a DOC COMMENT only (not executable)
      citing the now-doubly-stale `${producer}::${fact.id}` formula —
      cosmetic fix once the `graph-links.ts` site above is fixed.
    - `app/lib/factOrder.ts` — confirmed (again) does NOT reference
      `fact.id`/`fact.sourceText` anywhere — no fix needed.
    - `app/lib/factConditions.ts:208` — `HANDLED_OR_LABEL_KEYS` still lists
      `'sourceText'`/`'id'` as "shown elsewhere" keys — harmless dead
      entries now (neither key will ever actually be present on a real
      served fact going forward), not a functional bug, but worth a
      cleanup pass whenever `card` agent is next in this file.
  - Verified (full, final pass, after ALL of the above): `npx vitest run
    functional-model` → 230/230 (13 test files). `npx vite-node
    functional-model/scripts/verify-synergy.mjs` (full pool) → 313 checked,
    1 hard failure — confirmed still only the pre-existing, unrelated
    `auron-s-inspiration`; zero annotation-coverage violations printed.
    `summon-bahamut`-scoped run → 0 hard failures (only the pre-existing
    `tapForMana` soft notes). `npx tsc --noEmit -p
    functional-model/tsconfig.json` → 58 errors, up from the documented
    57-error pre-task baseline by exactly ONE — the unavoidable TS7016
    "could not find a declaration file" for `annotation-coverage.test.ts`'s
    own plain-`.mjs` import (same known, harmless, already-tolerated class
    `scenario-card-names.test.ts`'s own identical TS7016 already is); the
    OTHER `synergy.test.ts` fallout from `annotations` becoming required
    (16 disposable fixture literals needed a shared `FIXTURE_ANNOTATIONS`
    constant added to stay green — explicitly NOT real annotations, just
    the minimum shape a wholly-imaginary matching-logic fixture needs to
    compile, documented as such inline) is now fully resolved, zero net
    new errors from that path.
  - **Open Forge-verification**: none — this whole batch is fact-schema/
    identity-convention/generation-pipeline rework (data model + tooling +
    docs), no `harness.ts`/`interfaces.ts`/rules-engine behavior touched.
    The one CR citation used above (701.20a, for confirming
    `self-graveyard`'s `from`/`to` is correct) is a rules-vocabulary
    justification for a label/shape decision already made earlier today,
    not a new engine-behavior claim.

- **2026-09-11 (latest+6) — removed `Fact.id` entirely from `ZoneFact`/
  `EventFact` (`synergy.ts`), per explicit user call: facts are shorter/
  simpler under the new `annotations` model, and the "stable identity
  across regen/diffing" argument for keeping `id` (raised and REJECTED by
  the user this same session, see the `latest+3` entry below — that entry's
  own framing that `id` "stays exactly as-is" is now superseded by this
  later, final decision) is no longer needed. The pre-existing `role`+
  `sourceText`+`describeFact(fact)` fallback tuple (already used by the
  card page's own `factKey()`) is now the ONLY fact-identity convention,
  not a fallback.
  - `synergy.ts`: deleted `id: string` (and its doc comment) from both
    `ZoneFact` and `EventFact`. Added a new private `factIdentity(fact)`
    helper (`` `${fact.role}::${fact.sourceText}::${describeFact(fact)}` ``)
    — mirrors the card page's `factKey()` exactly, documented as such so the
    two don't drift. Used it to replace `InteractionMatch.theirFactId:
    theirs.id` (was reading the now-gone field) — `theirFactId` itself
    (consumed only by `server/api/graph-links.ts` for its own sink-grouping
    key, already `?? group.description`-guarded) keeps its name/shape, just
    now always a real derivable string instead of sometimes-`undefined`.
    Updated `InteractionMatch.theirFactId`'s own doc comment accordingly.
  - `functional-model/scripts/prefill-mana-facts.mjs`: deleted the whole
    `freshManaId()` helper (existed ONLY to mint `Fact.id` values —
    `"mana"`/`"mana-2"`/...) and the `id: freshManaId(synergy)` line from
    both fact-literal builders (single-color and choice-of-color shapes).
    No other script (`verify-synergy.mjs`, `find-synergies.mjs`,
    `compute-weights.mjs`, `compute-annotations.mjs`,
    `verify-scenario-card-names.mjs`, `scenario-card-names.mjs`) reads or
    writes `.id` on a Fact at all — confirmed via grep, nothing else to fix
    there.
  - `synergy.test.ts`: stripped every literal `id: '...'` field from fact
    fixtures (16 occurrences) and simplified the `zf`/`ef` test-builder
    helpers (`Partial<Omit<ZoneFact/EventFact, 'id' | 'role'>>` →
    `Partial<Omit<..., 'role'>>`, dropped their own `id: 'test'` default).
  - `cards/summon-bahamut/synergy.json` (the ONLY synergy.json touched, per
    scope): stripped the literal `"id": "..."` field from all 13 facts (11
    source + 2 sink) via a one-off Node script (JSON parse → delete `.id` on
    every element of both arrays → re-stringify with the same 2-space
    indent), not hand-edited — confirmed valid JSON and confirmed via `git
    status --porcelain -- functional-model/cards/*/synergy.json` that no
    other card's synergy.json was touched.
  - `SYNERGY_DESIGN.md`: checked — the "The fact model" section (and the
    whole file) never actually documented `id` as part of the schema in the
    first place (confirmed via a whole-file `id`/`identity` grep, zero
    hits), so no edit was needed there.
  - `.claude/contracts/card-schema.md`: the one stale line asserting
    "`Fact.id` is unaffected by any of this" (written during the earlier
    `annotations` rework, now false) rewritten into a proper "`Fact.id` has
    been removed entirely" section, explicitly telling `card` agent what to
    drop (`factKey()`'s `fact.id` branch, `openFactDebugModal`'s modal
    title) and pointing at the surviving `role`/`sourceText`/`describeFact`
    convention.
  - **Full app/server call-site list found via grep, NOT touched (out of
    lane, for `card` agent)**:
    - `app/components/FunctionalModelText.vue:66` — its own `factKey()`:
      `return f.id ?? \`${f.role}::${f.sourceText}::${describeFact(f)}\`;`
      — drop the `f.id ??` branch, keep the rest.
    - `app/pages/app/card/[set]/[number].vue:285` — the page's own
      `factKey()`, same shape: `return fact.id ?? \`${fact.role}::
      ${fact.sourceText}::${describeFact(fact)}\`;` — same fix.
    - `app/pages/app/card/[set]/[number].vue:331` —
      `openFactDebugModal`'s modal title: `` `Fact JSON — ${fact.id ??
      factKey(fact)}` `` — drop `fact.id ??`, just use `factKey(fact)`.
    - `app/lib/graphRenderer.ts:81` — a DOC COMMENT only (not executable
      code) citing `` `${producer}::${fact.id}` `` as the (no-longer-
      accurate) formula server-side; worth a wording fix once the
      `graph-links.ts` site below is fixed, not urgent.
    - `server/api/graph-links.ts:93` — `sourceKey` construction:
      `` `${name}::${group.fact.id ?? group.description}` `` — reads `.id`
      directly off a `Fact` object, will now fail to type-check (property
      doesn't exist) and needs the same role/sourceText/describeFact swap
      (or just drop to `group.description` alone, since that branch was
      already the same "??" fallback pattern) — this file is
      `server/api/graph-links.ts`, flagging for whichever of `card`/`ui`
      actually owns graph-link generation to pick up, per the task's own
      instruction to route findings through `card`.
    - `app/lib/factOrder.ts` — checked, does NOT reference `fact.id`
      anywhere (keys off `row.key`/`fact.annotations` only) — no fix needed
      there.
  - Verified: `npx vitest run functional-model` → 225/225 (unchanged
    baseline). `npx vite-node functional-model/scripts/verify-synergy.mjs`
    → 313 checked, 1 hard failure (confirmed still only the pre-existing,
    unrelated `auron-s-inspiration`). `npx tsc --noEmit -p
    functional-model/tsconfig.json` → 57 errors, same count as the
    documented `latest+5` baseline (the new `synergy.test.ts` errors this
    pass's `id`-removal surfaces — TS2353 excess-property complaints now
    naming `event`/`from`/`to`/`zone` instead of `id` — are the SAME
    pre-existing union-excess-property-check false positive documented
    under the `2026-09-11 — SOURCE ZoneFact reworked...` entry below, not a
    new class of error; net count unchanged).
  - **Open Forge-verification**: none — pure fact-schema/identity-
    convention removal (data model + reconciliation-tooling + test-fixture
    cleanup), no `harness.ts`/`interfaces.ts`/rules-engine behavior touched.

- **2026-09-11 (latest+5) — fixed all 4 fabricated (non-Scryfall) scenario
  card names the `scenario-card-names.mjs` check had been flagging since it
  landed (documented in the entry below as explicitly out-of-scope at the
  time), by swapping each for a real card whose real stats satisfy the exact
  same scenario role — checked what each stub's surrounding code/comments
  actually needed before picking a replacement, not name-matched blind.**
  - `cards/summon-bahamut/scenarios.ts`: `'Ally Legend'` → **Ahriman**
    (`data/fin/fin_scryfall.json`: `{2}{B}` Creature — Eye Horror, 2/2, mana
    value 3) — chapter IV's own "total mana value of other permanents you
    control" has no legendary restriction (confirmed by reading
    `definition.ts`'s chapter IV effect, not assumed from the old stub's
    name), so only nonzero mana value under your control was ever
    load-bearing; kept the exact same `basePower`/`baseToughness`/`cmc`
    (2/2/3) the old stub already had since Ahriman's real stats happen to
    match verbatim. Updated the top-of-scenario comment, the chapter-IV
    inline comment, and the `result` string to name Ahriman instead of "Ally
    Legend".
  - `cards/aerith-gainsborough/scenarios.ts`: `'Bystander Legend'` →
    **Freya Crescent** (`{R}` Legendary Creature — Rat Knight, 1/1) —
    confirmed via `definition.ts`'s `onDies` effect
    (`ctx.you.getCreaturesInPlay().filter((c) => c.hasSubtype('Legendary'))`)
    that legendary-ness on an OTHER creature you control is genuinely
    load-bearing here, not flavor — Freya's real stats (1/1) matched the old
    stub's hardcoded values exactly, no numeric change needed, just
    name/subtypes (`['Legendary','Rat','Knight']`) and a new comment
    explaining why a legendary is required. `'Lethal Blocker'` →
    **Gigantoad** (`{3}{G}` Creature — Frog, 4/4) — the only real FIN
    power≥4 creature; FIN has none with the old stub's toughness 1 (checked:
    no real FIN creature has power≥4 AND toughness≤2), so the old "double
    kill" side-effect (blocker also dying to Aerith's 2 power) isn't
    reproducible with a real card — confirmed this doesn't matter to the
    fact under test (`onDies` only branches on `aerithReal.zone ===
    'Graveyard'`, never on the blocker's own fate) before accepting the
    toughness change; updated `basePower`/`baseToughness` to Gigantoad's
    real 4/4 and reworded the nearby "704.5g can kill EITHER combatant"
    comment since Gigantoad no longer actually dies in this exchange (kept
    the general defensive-correctness point about `sideOf`/`controller`,
    dropped the now-inapplicable "was wrong for Lethal Blocker" specific
    claim). Confirmed Gigantoad's own conditional-land static buff and its
    ETB trigger, and Ahriman's/Freya's own printed abilities, are all inert
    here — none of these three are wired to a `CardDefinition` the harness
    would ever fire abilities from (they're raw `addCard` board-furniture,
    same as every other pool-wide filler stub), so their extra oracle text
    genuinely doesn't matter to the trace.
  - `cards/battle-menu/scenarios.ts`: `'Behemoth'` → **Coliseum Behemoth**
    (`{5}{G}{G}` Creature — Beast, 7/7) — confirmed this was a
    truncation/typo of a real card, not a fully separate invention (the real
    card exists in `data/fin/fin_scryfall.json`, well over the mode's power
    ≥4 threshold); updated `basePower`/`baseToughness` from the old stub's
    4/4 to Coliseum Behemoth's real 7/7, added `subtypes: ['Beast']`, and a
    comment noting its own ETB "choose one" trigger is inert for the same
    not-wired-to-a-CardDefinition reason as above.
  - Regenerated `trace.json` for all three via `run-scenarios.mjs
    --slug=<slug>` (one slug per invocation — the script only accepts a
    single `--slug=`, confirmed by reading its arg parsing after a
    multi-`--slug=` invocation silently only picked up the first one) —
    each regenerated cleanly, no engine exceptions.
  - Verified: `node functional-model/scripts/verify-scenario-card-names.mjs`
    → 0 violations (was 4). `npx vitest run functional-model` → 225/225
    (was 224/225 — the `scenario-card-names.test.ts` failure this fixes is
    now green, no other test regressed). `npx vite-node
    functional-model/scripts/verify-synergy.mjs` → 313 checked, 1 hard
    failure — same pre-existing, unrelated `auron-s-inspiration`; all three
    touched cards are clean `note`s (only the pre-existing pool-wide
    `tapForMana` soft-note noise, nothing new).
  - **Open Forge-verification**: none — pure scenario-authoring content swap
    (real card in, fabricated stub out), no `harness.ts`/`interfaces.ts`/
    rules-engine behavior touched. The one thing worth a future glance if
    anyone touches this area again: Gigantoad's own real "control seven or
    more lands" static buff and Coliseum Behemoth's own real ETB trigger are
    currently inert only because these stubs aren't wired to a
    `CardDefinition` — if this pool ever starts letting board-filler stubs
    reference their OWN real `CardDefinition` (not the case today), these
    two would need a second look.

- **2026-09-11 (latest+4) — deleted the deprecated `annotateOracleText`/
  `AnnotatedSegment`/`AnnotatedFactRef` outright from `synergy.ts`**, per
  coordinator confirmation that the `card` agent finished migrating
  `app/`/`server/` off them (zero remaining real references, only
  historical comments). Direct follow-up to the entry immediately below.
  - Confirmed BEFORE deleting: `computeFactAnnotations`/`rawHighlightRange`
    never called `annotateOracleText` (dependency ran the other direction —
    `annotateOracleText` called the shared `rawHighlightRange` helper), so
    the delete is a clean removal, not a break of the new path.
  - Cleaned up now-stale prose in surviving doc comments that named the
    deleted function/types as if they still existed in this file (the
    `AnnotationRef`/`rawHighlightRange`/`computeFactAnnotations` doc
    comments, and the `Fact.id`/`Fact.highlight` field doc comments that
    used to point at `annotateOracleText`'s "hover wiring"/"inline
    card-text view") — reworded to past tense / point at the real current
    consumer instead of a dangling name.
  - `.claude/contracts/card-schema.md`'s handoff section was already marked
    DONE by the coordinator before this pass — no doc change needed there.
  - Verified: `npx vitest run functional-model` → 224 passed, 1 failed
    (225 total, same pre-existing unrelated `scenario-card-names.test.ts`
    failure). `npx vite-node functional-model/scripts/verify-synergy.mjs`
    → 313 checked, 1 hard failure (pre-existing, unrelated
    `auron-s-inspiration`). `npx tsc --noEmit -p
    functional-model/tsconfig.json` → 57 errors, unchanged from the
    pre-deletion baseline.
  - **Open Forge-verification**: none — pure dead-code removal, no
    behavior change.

- **2026-09-11 (latest+3) — replaced the "annotated card" live-recompute
  design with pointer-based `Fact.annotations`, per explicit user design
  ask (card = plain copy of real data; facts = pointers into it).** Scoped
  to summon-bahamut ONLY, per an explicit mid-task coordinator correction
  (dropped the "check other FIN cards, do the cheap ones" exploration
  entirely — single-card change this pass, pool-wide is a separate later
  decision). Also explicitly did NOT touch `Fact.id` — a second mid-task
  correction reversed an earlier "ids become irrelevant" framing; `id`
  stays exactly as-is (stable identity across regen/diffing, Facts-table
  row key, debug-modal title — unrelated to what `annotations` replaces).
  - `synergy.ts`: added `AnnotationRef` (`{target:'oracle', line, start,
    end}`) + `Fact.annotations?: AnnotationRef[]` on both `ZoneFact`/
    `EventFact`. **Indexing convention** (documented on the interface
    itself, since `card` agent needs to implement matching slice logic):
    `line` = 0-indexed within the OWNING FACE's own real
    `oracleText.split('\n')` (which face = `Fact.face`); `start`/`end` =
    character offsets WITHIN THAT LINE ONLY (half-open) — a consumer
    slices via `oracleText.split('\n')[line]!.slice(start, end)`, no
    whole-text offset math needed. Chose line-relative over whole-text-
    absolute specifically so a renderer never has to also carry the line-
    splitting logic just to use the numbers.
  - New exported `computeFactAnnotations(oracleText, fact)` — the ONE
    place `sourceText`/`highlight` get turned into a real range, shared by
    the new baked-once path AND (via a new private `rawHighlightRange`
    helper both now call) the OLD live `annotateOracleText`, so the two
    can't drift on what counts as a match. Same "first match, best effort"
    tolerance the old code had (`indexOf` returns first occurrence); a
    `highlight` phrase spanning more than one line (a genuine ambiguity
    line-relative indexing can't express) returns `undefined` rather than
    guessing — not hit by any real summon-bahamut fact.
  - `annotateOracleText`/`AnnotatedSegment`/`AnnotatedFactRef` marked
    `@deprecated` (JSDoc, not removed) — left working BYTE-IDENTICAL
    (confirmed via the refactor sharing `rawHighlightRange`, not a rewrite)
    so the pre-existing `card`-agent call sites
    (`server/api/card/[set]/[number].ts`'s `buildAnnotatedCard`,
    `app/components/FunctionalModelText.vue`) don't break before that
    agent finishes migrating off them.
  - New script `functional-model/scripts/compute-annotations.mjs` — the
    generation step: reads a card's `synergy.json`, resolves its real name
    via `definition.ts`, looks up real oracle text from
    `data/<set>/<set>_scryfall.json` (excluding `*_tokens_scryfall.json`,
    same real-card-data convention `scenario-card-names.mjs` already
    established), computes `computeFactAnnotations` per fact (face-aware:
    `fact.face ?? 'front'` selects `card_faces[0]`/`[1]` vs. the plain
    `oracle_text` field), and writes the result back into `synergy.json`.
    Written to generalize to the whole pool (`npx vite-node
    functional-model/scripts/compute-annotations.mjs [<slug>...]`, no args
    = whole pool) but ONLY RUN for summon-bahamut this pass, per the scope
    correction above.
  - `cards/summon-bahamut/synergy.json`: ran the script — 8 of 11 facts got
    real `annotations` (`destroy-act`, `destroy-nonland`,
    `chapter-iii-draw`, `chapter-iv-damage`, `self-sacrifice-graveyard`,
    `self-sacrifice`, `mega-flare-you`, `mega-flare-opp`); 3 facts have no
    `annotations` because they fail the SAME match the old
    `annotateOracleText` already silently skipped for them — not a new
    gap: `self-cast`/`self-enters`/`self-dies` have no `highlight` at all
    (bare parenthetical `sourceText` only), and `self-battlefield`'s own
    `sourceText` ("Flying (Summon: Bahamut is itself a flying creature
    permanent on your battlefield).") was NEVER a verbatim oracle-text
    substring (the parenthetical gloss isn't real card text) — confirmed
    this already failed to match under the OLD live code too, so nothing
    regressed. Verified every computed `(line,start,end)` slices back to
    exactly the authored `highlight` string via a real `oracle_text.split
    ('\n')[line].slice(start,end)` check against `data/fin/fin_scryfall.json`'s
    own real Summon: Bahamut entry, not just reasoned about.
  - `SYNERGY_DESIGN.md`: fact-model section rewritten to document
    `annotations` (shape, indexing convention, what it replaces) in place
    of the old `annotateCardText`/live-recompute description.
    `.claude/contracts/card-schema.md`: new "Fact-to-oracle-text pointers"
    section — the exact served-shape change `buildAnnotatedCard`/
    `AnnotatedCard`/`AnnotatedFace` need (drop `oracleLines:
    AnnotatedSegment[][]`, serve raw `oracleText: string` instead) and
    what `FunctionalModelText.vue` needs to do instead, file-by-file, for
    the `card` agent to pick up — **not done here, explicitly out of lane**
    (`server/api/card/[set]/[number].ts`, `app/types.ts`,
    `app/components/FunctionalModelText.vue`, `app/lib/factOrder.ts` all
    still reference the deprecated segment-tree shape, untouched by this
    pass on purpose).
  - Verified: `npx vitest run functional-model` → 224 passed, 1 failed
    (225 total) — same pre-existing, out-of-scope
    `scenario-card-names.test.ts` failure as every other recent entry in
    this file (4 fabricated names, not fixed here per explicit scope).
    `npx vite-node functional-model/scripts/verify-synergy.mjs` → 313
    checked, 1 hard failure (pre-existing, unrelated
    `auron-s-inspiration`); summon-bahamut itself clean (only pre-existing
    `tapForMana` soft notes). `npx tsc --noEmit -p
    functional-model/tsconfig.json` → 57 errors, same as the last
    documented baseline in this file (all pre-existing
    `synergy.test.ts`/card `definition.ts` noise) — confirmed zero new
    errors from this change. `trace.json` untouched (this is a
    `synergy.json`-only generation step, independent of scenario
    execution).
  - **Noted, not investigated further**: `functional-model/scripts/
    scenario-card-names.mjs`, `verify-scenario-card-names.mjs`,
    `scenario-card-names.test.ts` exist on disk as untracked (`??`) files
    NOT created by this task, predating it per this file's own earlier
    2026-09-11 entry ("new permanent, enforced check...") but absent from
    THIS conversation's own initial `git status` snapshot — almost
    certainly a concurrent/peer orchestrator session's work landing on
    disk between that snapshot and this task starting (this project's
    documented "multiple orchestrators" norm). Left untouched, not
    reverted, not claimed as mine.
  - **Open Forge-verification**: none needed — this is a synergy fact-
    schema/served-shape change (data model + a new offline generation
    script), not new engine mechanics.

- **2026-09-11 (latest+2) — fixed a real duplicate-label bug the zone-
  change rework (entry below, "SOURCE `ZoneFact` reworked...") introduced:
  `self-battlefield` on summon-bahamut got mechanically converted to
  `to: 'Battlefield'` even though it was never a movement — it's a
  presence-with-Flying fact (sourceText/highlight are both about Flying,
  exists only so another card's "you control a flying creature" sink can
  match), and forcing it through `zoneMovementName` made it render "enters
  the battlefield", identical to the genuine ETB fact (`self-enters`).
  Reverted `self-battlefield` back to `zone: 'Battlefield'` (presence-
  shaped) in `cards/summon-bahamut/synergy.json` — now renders "battlefield
  presence" again, no longer colliding. `self-sacrifice-graveyard`'s own
  `from:'Battlefield',to:'Graveyard'` → "dies" conversion is untouched and
  stays correct (sacrifice really is a zone-change event).
  - **Pool-wide sweep, not just this card**: `grep '"to": "Battlefield"'
    cards/*/synergy.json` — summon-bahamut was the ONLY card with any
    SOURCE `to`/`from` fact at all (confirmed by the rework's own doc —
    it was explicitly scoped to just this one card, no pool-wide
    migration ever happened), so there was nothing else to fix.
  - Added a "Correction" addendum directly under the original rework's own
    `SYNERGY_DESIGN.md` writeup (not a silent edit — the original entry's
    reasoning about `self-battlefield` was wrong, now flagged as such
    inline where a future reader would otherwise trust it).
  - **`trace.json` NOT regenerated** — it's built purely from
    `scenarios.ts` execution (`run-scenarios.mjs`), independent of
    `synergy.json`; confirmed no reference to `synergy.json` in that
    script. A `synergy.json`-only fix has nothing for a trace regen to
    pick up.
  - Verified: `npx vitest run functional-model` → 224 passed, 1 failed
    (225 total) — the 1 failure is the separately-scoped, pre-existing
    `scenario-card-names.test.ts` (4 fabricated scenario card names
    pool-wide, documented in the entry above this one as intentionally
    out-of-scope-to-fix-here); this exactly matches the "224/224 baseline"
    this fix was asked to confirm, that new test just wasn't in the count
    when that number was first established. `node
    scripts/verify-synergy.mjs` → 313 checked, 1 hard failure (same
    pre-existing unrelated `auron-s-inspiration`), summon-bahamut itself
    clean (only pre-existing `tapForMana` soft notes). Real regenerated
    `describeFact` output against the actual fact objects (not hand-typed):
    `self-enters` → "enters the battlefield", `self-battlefield` →
    "battlefield presence" (previously identical to each other before this
    fix).
  - **Open Forge-verification**: none — pure fact-schema correction
    (reverting a mechanical-conversion mistake in a label-derivation
    rework), no `harness.ts`/`interfaces.ts`/rules-engine behavior touched.

- **2026-09-11 (latest) — new permanent, enforced check: every literal
  `addCard(...)` card NAME across every `cards/*/scenarios.ts` must be a
  real Scryfall card, not an invented placeholder — wired into BOTH
  `npm run test` and the manual `verify-synergy.mjs` sweep, not left a
  one-off script (explicit ask: don't repeat `.tmp-check-images.mjs`'s
  bitrot).** Direct follow-up to this same file's own 2026-09-11-earlier
  entry flagging `allyLegend`/`otherLegend`-shaped stubs as systemic.
  **Fixing the flagged cards themselves is explicitly OUT of this task's
  scope** — building+landing the check, and confirming it actually catches
  what's already broken, was the whole ask.
  - New files: `scripts/scenario-card-names.mjs` (shared logic — plain JS,
    no vite-node/TS-import needed, since it's pure text/JSON, deliberately
    kept `node`-runnable per its own header), `scripts/
    verify-scenario-card-names.mjs` (CLI wrapper, human-readable report,
    `node functional-model/scripts/verify-scenario-card-names.mjs`),
    `scenario-card-names.test.ts` (top-level, matching the pool's existing
    `*.test.ts`-alongside-subject convention — this is what makes it run
    under plain `npm run test`/`vitest run`, the strongest "actually
    blocks" form available, not just a manually-invoked script).
  - **Scope, deliberately narrow** (matches the task's own explicit
    constraint): only a literal `name: '...'`/`name: "..."` STRING inside an
    `addCard(...)` call's own object-literal argument is checked — a
    `name: someCard.name` PROPERTY ACCESS (referencing an imported
    `CardDefinition`, the overwhelming majority of `name:` usages in the
    pool) is skipped, not a literal. A `PlayerState.tokens` catalog key
    (`tokens: ['c_a_treasure_sac']`, `tokens.ts`'s own `TOKENS` map) is
    explicitly out of scope per the task's own instruction — confirmed via
    grep that no scenario in the pool ever constructs a token via a literal
    `addCard(..., {name:...})` call anyway (`TOKENS.` never appears in any
    `cards/*/scenarios.ts`), so this never even has to special-case it.
    Basic lands (Plains/Island/Swamp/Mountain/Forest/Wastes) are a small
    static allowlist (real, universally-reprinted cards regardless of
    whether one particular set's own data file happens to carry them).
  - **Real-card ground truth**: every `data/<set>/<set>_scryfall.json` file
    (today, only `fin/` — written to generalize to whatever sets the
    historical-sets sweep adds later, per the task's own "across all set
    files under data/*/" ask), explicitly EXCLUDING `*_tokens_scryfall.json`
    (a different Scryfall card space — a same-named TOKEN existing
    shouldn't validate a fabricated nontoken-permanent name). Double-faced
    cards indexed by both their combined `name` and each individual
    `card_faces[].name`, for a hypothetical future scenario naming just one
    face. Uses `data/`, never `dist/` (the generated build copy).
  - Brace-balanced parsing (not a naive `[^}]*` regex) for the `addCard(...)`
    object literal itself, so a future opts object nesting another
    `{...}`-shaped field (`ptFormula`, a real flat-object `RealCard` field
    per `state.ts`) can't truncate the scan early — verified safe across the
    full real 320-card pool with zero exceptions/false parses.
  - **Wired into `verify-synergy.mjs`** (not just the new `.test.ts`): added
    an import + a final pool-wide (or `requested`-slug-filtered, matching
    that script's own existing slug-scoping) check after the existing
    per-card loop, contributing to the SAME `hardFailures`-driven nonzero
    exit — so `verify-synergy.mjs summon-bahamut` now ALSO reports that
    card's own `'Ally Legend'` violation in the same run, not a separate
    command someone has to remember to also run. Matched the file's own
    documented hard-failure (not soft-note) convention explicitly, per the
    task's own instruction that a fabricated name is a straight authoring
    violation, not an "engine can't represent this yet" gap.
  - **Verified real, not asserted**: ran the CLI cold against the current
    pool (below); ran a disposable scratch-dir fixture pair (one real
    literal name, one fabricated one) through `findFabricatedScenarioCardNames`
    directly to confirm it's discriminating, not blanket-flagging everything
    — the real one passed silently, only the fabricated one was reported;
    confirmed `verify-synergy.mjs`'s exit code is genuinely 1 (not just its
    printed text) both pool-wide and slug-scoped, via a real `$?` check
    piped through a logfile (not through `tail`, which would have reported
    tail's own exit code instead — caught and fixed this exact mistake
    mid-task).
  - **Current pool result — 4 violations, all already flagged/expected, not
    new discoveries**: `cards/summon-bahamut/scenarios.ts:42` (`'Ally
    Legend'`), `cards/aerith-gainsborough/scenarios.ts:42` (`'Bystander
    Legend'`), `cards/aerith-gainsborough/scenarios.ts:54` (`'Lethal
    Blocker'`), `cards/battle-menu/scenarios.ts:39` (`'Behemoth'` — close to
    but not the same as the real `Coliseum Behemoth`). This is the full
    current-pool list — no fabricated name outside what this file's own
    earlier 2026-09-11 entry had already flagged. **`npm run test` is now
    RED because of this** (1 new failing test on top of the 5 pre-existing
    unrelated `scripts/relations.test.mjs` ENOENT failures — 6 total, 340
    passing, confirmed via a real `vitest run` — matches the documented
    "expected non-passing on current pool" outcome exactly) — the follow-up
    to actually fix these 4 names is separately scoped, NOT done here.
  - **tsc delta**: added ONE net-new tolerated tsc error (57, up from the
    documented 56 baseline) — a TS7016 "could not find declaration file"
    for `scenario-card-names.test.ts`'s own import of the deliberately
    plain-JS `scenario-card-names.mjs` (no `.ts`/`.d.ts` possible without
    breaking the "importable under plain `node`, no build step" requirement
    both CLI entry points need — tried a colocated `.d.ts`/`.mjs.d.ts`
    first, neither got picked up by this tsconfig's `Bundler` resolution for
    an explicit `.mjs` specifier, abandoned rather than fight the resolver
    further). Inert to runtime (vitest transpile-only; the actual violation
    array IS correctly typed via an explicit `: ScenarioCardNameViolation[]`
    local annotation, which DOES type-check — only the raw module import
    itself is `any`) — same "small stable duplicate, tolerated tsc noise"
    class of trade this file's own 2026-09-11-earlier `ZONE_NOUN`/local
    `effectiveZone` entries already accept, not a new category of problem.
  - **Open Forge-verification**: none — this is pool-authoring-discipline
    tooling (a static text/JSON check), not engine mechanics; nothing in
    `harness.ts`/`interfaces.ts`/rules behavior was touched.

- **2026-09-11 (later) — summon-bahamut scenario A's opponent destroy
  target switched from a Treasure TOKEN to a real, non-token FIN creature
  (Coeurl — `data/fin/fin_scryfall.json`: `{1}{W}` Creature — Cat Beast,
  2/2), per direct user instruction that the target be a real card, not
  generic filler. This directly removed the reason scenario B (the
  forced-self-destroy corner case, reinstated 2026-09-10 to back the
  `destroy-act` event fact) existed at all.**
  - `scenarios.ts`: replaced `opponents: [{ tokens: ['c_a_treasure_sac'],
    ... }]` with a plain `opponents: [{ libraryCount: 10 }]` plus a real
    `pilot.state.addCard(pilot.opponents[0]!, 'Battlefield', {name:
    'Coeurl', ...})` + a manual `enters` log entry (needed because,
    unlike `PlayerState.tokens`, an `addCard`'d permanent isn't part of
    `raw.opponents[0]` for the replay UI to reconstruct from setup alone —
    same reasoning the pre-existing `allyLegend`/`otherLegend` pattern in
    this file and `aerith-gainsborough`'s own scenario already establish).
    `preferTarget` updated `c.getName() === 'Treasure'` →
    `c.getName() === 'Coeurl'`. Rewrote the top-of-file doc comment and the
    inline chapter-I/II comments and `result` string to describe Coeurl,
    not Treasure, and to drop the now-inapplicable 704.5d/token-
    ceases-to-exist citations (Coeurl is a real permanent — a normal
    701.6/704.5g graveyard-bound destroy, not a ceases-to-exist).
  - **Verified before removing scenario B, not assumed**: regenerated
    `trace.json` via `run-scenarios.mjs --slug=summon-bahamut` with BOTH
    scenarios still present, confirmed scenario A's own kill now logs a
    literal `{fn:'destroy', target:'Coeurl', controller:'opp0'}` line
    (previously `ceasesToExist`, per the Treasure-token gap the
    2026-09-10 entry below documents) — checked the actual regenerated
    `trace.json`, not reasoned about it. `verify-synergy.mjs
    summon-bahamut` — 0 hard failures with both scenarios (18 tapForMana
    soft notes, same as before). Only THEN removed `scenarioB` and
    `runEngineScenarios`'s reference to it, regenerated `trace.json` again
    (1 scenario now), re-ran `verify-synergy.mjs summon-bahamut` — still 0
    hard failures, 9 tapForMana soft notes (half of the 2-scenario count,
    as expected) — confirming scenario A alone now fully backs
    `destroy-act` with no scenario B needed, same evidence-check
    discipline as the original 2026-09-10 scenario-B removal.
  - `progress.json`: fixed one now-factually-wrong `knownGaps` bullet this
    change directly contradicted ("opponent's own artifact is never
    actually a reachable destroy target" — false as of this change:
    `preferTarget` overrides the pool's own self-first default pick, it
    isn't blocked by pool ordering the way plain `chooseTarget` would be)
    — replaced with a dated "resolved" note rather than deleting it
    silently. **Flagged, not touched**: this file's own top-level `notes`
    field is a separate, much older narrative (predates even the
    Treasure-token version of this scenario — describes both chapters I
    AND II declining, which hasn't been true since well before this task)
    — clearly stale, but out of THIS task's scope to rewrite wholesale;
    worth a real cleanup pass sometime. `lastVerified` was already
    `2026-09-11` from an earlier pass today — left as-is (same day).
  - Verified: `npx vitest run functional-model` 224/224 (unchanged count —
    no test touches this card's scenario shape by name). Full-pool
    `verify-synergy.mjs`: 313 checked, 1 hard failure — same pre-existing,
    unrelated `auron-s-inspiration` as every prior baseline in this file.
  - **Flagged, not fixed (out of this task's scope but worth a follow-up)**:
    while sourcing a real replacement name, found this card's OWN
    `allyLegend`/`otherLegend`-style stub (`name: 'Ally Legend'`, line
    ~42) is itself an invented placeholder name, not a real Scryfall card
    (confirmed absent from `data/fin/fin_scryfall.json` and every other
    set file) — and the exact same pattern recurs elsewhere in the pool
    (`battle-menu`'s `'Behemoth'` — close to but not identical to the real
    `Coliseum Behemoth`; `aerith-gainsborough`'s `'Bystander Legend'`/
    `'Lethal Blocker'`). This appears to be an established, systemic
    convention for pure board-furniture stubs across the pool, not an
    isolated slip — but it's in real tension with the project's own
    "scenario replay: real not mocked" rule as written. Left untouched
    (not this task's ask, and fixing it pool-wide is a real separate
    task), but flagged since it's the same rule category as this task's
    own explicit instruction.
  - **Open Forge-verification**: none needed — swapping which real
    permanent a scenario destroys is scenario-authoring/board-content
    only; the underlying `destroy`/`ceasesToExist`/`704.5d` engine
    behavior in `harness.ts` was already correct and untouched.

- **2026-09-11 — SOURCE `ZoneFact` reworked into an explicit zone-CHANGE
  shape (`to`/`from`), replacing bare presence-style `zone` on the source
  side only — SINK facts untouched.** Full rationale/shape now in
  `SYNERGY_DESIGN.md`'s "The fact model" section + a matching addendum at
  the file's end (read those before touching this area again — not
  re-duplicating the full writeup here). Summary for quick resume:
  - `synergy.ts`: `ZoneFact.zone` is now optional; added `to?`/`from?`
    (SOURCE-only — `to` = destination, `from` = optional origin, omitted
    = unknown/any). New private `effectiveZone(fact)` choke point
    (`fact.zone ?? fact.to`) used by `isZoneFact`, `factsInteract`,
    `factKind`, `describeFact` so a pre-rework bare-`zone` source fact
    keeps matching/rendering byte-identically — **no pool-wide migration
    was needed for this to be safe**, only the two facts on
    `summon-bahamut` were actually converted. `factsInteract`'s zone-vs-
    zone branch compares SOURCE `to` against SINK `zone` only — `from` is
    deliberately excluded from that comparison (the explicit "match on
    `to` alone, ignore origin" design goal).
  - New exported vocabulary (data, not buried in `describeFact`'s control
    flow, so `card`-agent Facts-tab work can consume it directly):
    `ZONE_MOVEMENT_NAMES` (`{from?, to, name}[]`) and
    `zoneMovementName(from, to)`. Two entries seeded (grow only when a
    real card forces it, same discipline as the rest of the constraint
    vocabulary): `to:'Battlefield'` (any `from`) → "enters the
    battlefield"; `from:'Battlefield', to:'Graveyard'` → "dies" (CR 700.4
    — battlefield→graveyard is dying regardless of cause, including
    sacrifice; no extra type/target constraint needed since a `ZoneFact`
    always describes a persistent object). `describeFact` calls this for
    any SOURCE zone fact declaring `to`/`from`, falling back to the
    unchanged bare "<zone> presence" when the pair isn't named yet.
  - `cards/summon-bahamut/synergy.json`: converted `self-battlefield`
    (`zone:'Battlefield'`→`to:'Battlefield'`, now labels "enters the
    battlefield") and `self-sacrifice-graveyard` (`zone:'Graveyard'`→
    `from:'Battlefield',to:'Graveyard'`, now labels "dies"). Its two SINK
    zone facts (`mega-flare-you`/`mega-flare-opp`) untouched, per scope.
    `progress.json.lastVerified` bumped to 2026-09-11 (re-ran
    verify-synergy.mjs as part of this pass, real pass).
  - **`scripts/verify-synergy.mjs`, `scripts/find-synergies.mjs`,
    `scripts/compute-weights.mjs` all needed fixes** — each has its own
    local `isV2Shaped` (all three widened to accept `'to' in f || 'from' in
    f`, not just `'zone' in f`) and, in verify-synergy.mjs/
    compute-weights.mjs, a `'zone' in p`-gated branch reading `p.zone`
    directly for a SOURCE fact's forward/reverse trace-evidence check —
    all switched to the same `p.to ?? p.zone` fallback (a small local
    `effectiveZone(f)` mirror in each .mjs file, since these plain scripts
    don't import synergy.ts's own PRIVATE helper — consistent with the
    existing "small stable duplicate rather than widen the engine import"
    trade elsewhere in this codebase, e.g. `ZONE_NOUN` in
    factConditions.ts). **This was a real gap, not a defensive add**:
    without it, `isV2Shaped` would have wrongly excluded summon-bahamut
    from `find-synergies.mjs`/`compute-weights.mjs` entirely (a `.every()`
    check — ANY fact missing both `zone` and `event` fails the WHOLE
    file), and verify-synergy.mjs's `'zone' in p` branch would have
    misrouted a converted fact into the EVENT-fact evidence path (reading
    `p.event`, undefined on a zone fact) and hard-failed it.
  - Verified: `npx vitest run functional-model` 224/224 (216 prior + 8 new
    — a new `describeFact` zone-change describe block + a new top-level
    `factsInteract`/`findInteractionsForCard` matching describe block, both
    exercising real `(from,to)` shapes, not invented ones). Full-pool
    `verify-synergy.mjs`: 313 checked, 1 hard failure — same pre-existing,
    unrelated `auron-s-inspiration` (Exile-zone produce gap) as every
    prior pass. `find-synergies.mjs`: 313 v2-authored (unchanged from
    before this pass — confirmed summon-bahamut wasn't dropped). Isolated
    A/B via a scoped `git stash push -- <the touched files>` around
    `find-synergies.mjs`'s own Summon: Bahamut output: same set of matched
    cards before/after, only the LABEL text changed (battlefield
    presence→enters the battlefield, graveyard presence→dies) — confirms
    the matching-logic change is label-only, not a behavior change.
  - **`npx tsc --noEmit -p functional-model/tsconfig.json`: 56 errors, up
    from the documented 50-error baseline — flagged, not silently
    accepted as zero-delta.** All 6 new ones are the SAME pre-existing TS
    union-excess-property-check false positive `synergy.test.ts` already
    had 7 instances of before this pass (lines 28-74, e.g. `{event:
    'addMana', ...} satisfies Omit<EventFact,'role'>` inside a `poolCard(
    ..., [literal], ...)` call — TS's weak-type excess-property check
    misfires once the literal is contextually typed against the `Omit<
    Fact,'role'>` UNION rather than one concrete branch) — my new
    `factsInteract`/`findInteractionsForCard` matching tests use the
    identical established `poolCard([{...} satisfies Omit<ZoneFact,
    'role'>], ...)` pattern for the new `to`/`from` shape and hit the same
    quirk. Inert to runtime (vitest transpile-only, doesn't type-check;
    all 224 tests pass for real) and to `verify-synergy.mjs`/
    `find-synergies.mjs` (plain `.mjs`, no static type-checking at all) —
    but it IS a real, visible tsc-count regression from the documented
    baseline, unlike every other entry in this file. Left as-is rather
    than restructuring the new tests around a known, already-tolerated
    quirk — flagging here so a future pass doesn't mistake it for a fresh
    regression.
  - **Card-agent-facing, explicitly NOT done here (out of lane)**: the
    Facts tab's own rendering (labels, notes/conditions column, any
    `from`/`to` display) — `zoneMovementName`/`ZONE_MOVEMENT_NAMES` are
    exported specifically so that work doesn't need to re-derive the
    mapping independently.
  - **Not done, flagged rather than silently skipped**: a full pool-wide
    migration of every other card's own SOURCE `zone` fact to `to`/`from`
    — real per-card authoring judgment (what's the actual origin zone),
    not a mechanical rename; explicitly out of this task's scope
    ("Summon: Bahamut and whatever other FIN cards are in the current
    uncommitted diff" only). The `effectiveZone` backward-compat fallback
    means nothing else regressed by leaving this undone.
  - Also touched, WIP conflict check: `git diff` before starting showed
    uncommitted work already in flight on `synergy.ts`/`synergy.test.ts`/
    `compute-weights.mjs`/`verify-synergy.mjs`/summon-bahamut's own
    `synergy.json`/`scenarios.ts`/`progress.json` (the `-1` Weight
    sentinel, `EventFact.recipient`, the bare-label single-dimensional
    redesign, `self-cast`/`self-enters`/`self-counters`/`destroy-act`/
    literal-`sacrifice` event facts — all documented in this file's own
    prior entries above). None of it touched `ZoneFact`'s own shape or
    `zone`-matching logic, so there was no real conflict — built on top of
    it cleanly, didn't revert or clobber any of it. (`find-synergies.mjs`
    was NOT already in the WIP diff before this task — untouched by any
    earlier session today — first touched by this pass.)
  - **Open Forge-verification**: none needed — pure fact-schema/label-
    derivation rework (data model + reconciliation-tooling fixes), no
    rules-engine behavior touched; the CR 700.4 "dies" citation justifies
    the DERIVED LABEL mapping's naming choice, not any `harness.ts`
    execution behavior.

- **2026-09-10 (latest+4) — literal `destroy` EventFact added to Summon:
  Bahamut (`destroy-act`), mirroring the `sacrifice` act-vs-consequence
  split from the entry just below.** `describeFact` had no `destroy` branch
  — confirmed it falls through the generic fallback (`return event`),
  which already renders bare `"destroy"` correctly per the single-
  dimensional label design; no branch added (verified via a real
  `describeFact` call against the actual authored fact object, not just
  reasoned about — see below).
  - `synergy.json`: added `{id:'destroy-act', event:'destroy',
    target:{types:{not:['Land']}}, value:-1, sourceText:"I, II — Destroy up
    to one target nonland permanent.", highlight:"Destroy up to one target
    nonland permanent"}` — same `target` shape and highlighted span as the
    pre-existing `destroy-nonland` fact (`{event:'dies', target:{types:
    {not:['Land']}}}`), which stays the CONSEQUENCE-only fact, untouched.
    No `target:'self'`/self-reference — same as `destroy-nonland`, Bahamut
    is the source/actor here, not what dies. `value:-1` (the hand-authored-
    placeholder sentinel, not yet run through `compute-weights.mjs`), same
    convention as `self-cast`/`self-enters`/`self-counters`/`self-sacrifice`
    below.
  - **Real gap found and fixed in `verify-synergy.mjs`, same shape as the
    `sacrifice` fix**: `producedEvents()`'s `case 'destroy'` only returned
    `[{event:'dies',...}]` — `harness.ts`'s own `destroy` handler (line
    ~784-802) already logs a literal `{fn:'destroy', target, controller}`
    entry (CR 701.6, distinct from the `dies` consequence) whenever the
    destroyed target is a REAL (non-token) permanent, but nothing mapped it
    to a `destroy` event fact. Added a second element to the returned array,
    `{event:'destroy', side: sideOf(entry, cardName)}`, mirroring
    `sacrifice`'s own two-events-per-log-line shape exactly. **Deliberately
    did NOT also add `destroy` to the `ceasesToExist` case** (used when the
    destroyed target is a TOKEN — 111.7/704.5d, it ceases to exist instead
    of sitting in the graveyard): that log shape is genuinely ambiguous —
    an unrelated `moveTo(target, 'Graveyard')` effect on a token (e.g.
    tellah-great-sage/elven-passage/eden-seat-of-the-sanctum's own real
    "put this card into its owner's graveyard" effects, none of which are a
    CR 701.6 destroy) logs an IDENTICAL `{fn:'ceasesToExist', zone:
    'Graveyard', ...}` line, so crediting every such line as `destroy`
    evidence would be a real false positive, not a conservative widening.
  - **Real scenario-coverage gap found, not just a synergy.json/script fix**:
    summon-bahamut's own scenario A (the only one checked into `HEAD`,
    working-tree at the time still had scenario B removed as a WIP
    uncommitted edit from an unrelated earlier task) destroys the
    opponent's Treasure TOKEN — which means its own supporting trace line
    for `destroy-nonland` was always `ceasesToExist`, never a literal
    `fn:'destroy'` — so scenario A alone can't back a `destroy-act` event
    fact at all. `git diff HEAD` on `scenarios.ts` showed scenario B (chapter
    I forced to destroy Bahamut ITSELF — the only legal nonland target, a
    real non-token permanent) had been removed uncommitted, for a
    documented reason that predates this task ("added no fact coverage
    verify-synergy.mjs actually needed beyond [scenario A]" — true for the
    OLD fact set, no longer true now). Restored it via `git checkout HEAD --
    functional-model/cards/summon-bahamut/scenarios.ts` (confirmed via
    `git diff HEAD` that the file's ONLY divergence from HEAD was that one
    scenario-B removal, so a full-file revert was safe/equivalent to a
    surgical undo), then added an explanatory comment on top of the
    existing scenario-B doc comment recording BOTH the original removal
    reasoning and why it's back (rather than silently reverting a
    documented decision with no trace of why). Regenerated `trace.json` via
    `npx vite-node functional-model/scripts/run-scenarios.mjs
    --slug=summon-bahamut` — came out byte-identical to the already-checked-
    in `HEAD` version of `trace.json` (2 scenarios), confirming this
    "restore" is a genuine no-op relative to committed history, not a new
    trace shape.
  - Verified: `verify-synergy.mjs summon-bahamut` → 0 hard failures (same
    pre-existing `tapForMana` soft notes only, now 18 instead of 9 since
    scenario B also casts Bahamut for {9} — expected, not a regression).
    Full-pool sweep: 313 checked, 1 hard failure — confirmed still only the
    pre-existing, unrelated `auron-s-inspiration` (Exile-zone produce gap).
    `npx vitest run functional-model` → 216/216. `npx tsc --noEmit -p
    functional-model/tsconfig.json` → 50 errors, same pre-existing count as
    every prior entry in this file. Real regenerated label, via
    `describeFact` against the actual authored fact object (not
    hand-typed): `destroy-act` → `"destroy"`.
  - **Open Forge-verification**: none needed — this is synergy-vocabulary/
    verify-synergy.mjs reconciliation-tooling plumbing + fact authorship +
    a scenario-coverage restoration, not new engine mechanics; the
    underlying `destroy`/`ceasesToExist` engine behavior in `harness.ts` was
    already correct (Forge-cited via CR 701.6/111.7/704.5d in its own
    existing comments) and untouched by this pass.

- **2026-09-10 (latest+3) — `-1` sentinel added to `Weight`, distinct from
  `undefined`.** `undefined` still means "predates the weight fields
  entirely" (unknown); `-1` now means "has a value field, but it's a
  hand-authored placeholder pending a real `compute-weights.mjs` pass," per
  explicit task ask.
  - `synergy.ts`: `Weight` widened to `-1 | 1 | 2 | 3 | 4 | 5`; `factTotal`
    changed from `fact.value ?? null` to `fact.value != null && fact.value >
    0 ? fact.value : null` — the ONE choke point every arithmetic consumer
    goes through (`InteractionMatch.theirTotal`, `server/api/graph-links.ts`'s
    `mineValue`/`theirValue`, both already `?? 1`-floor a `null`), so `-1`
    is excluded from weighting/combination math without touching any
    consumer. Raw `fact.value` (e.g. the Facts-table `AnnotatedFactRef`,
    line ~575) is untouched — still shows `-1` verbatim, which is the
    point (stays findable, doesn't silently disappear back to unset).
  - `compute-weights.mjs`: confirmed NO code change needed for the "does a
    future run resolve `-1` naturally" ask — the write-back step already
    never reads a fact's own existing `value` before overwriting it with a
    freshly computed one (only strips `role`/`weight`/`typeWeight`/
    `themeWeight`/`ease`, not `value`, then always sets `value: it.value`).
    Added a doc-comment clause making this explicit so nobody later "fixes"
    it with an unnecessary skip-if-negative guard.
  - `summon-bahamut/synergy.json`: checked `git diff HEAD` on the file to
    tell "hand-typed placeholder this session" apart from "already went
    through a real compute-weights.mjs pass, just happens to also be 1"
    (self-battlefield/self-dies/self-sacrifice-graveyard's `value:1` all
    trace to the 2026-09-05 commit that also gave destroy-nonland:4/
    chapter-iii-draw:4/chapter-iv-damage:5 their real computed values — same
    batch, so their neutral 1s are real "no magnitude concept" outputs, not
    placeholders — left alone). Switched to `-1`: `self-cast`, `self-enters`,
    `self-counters`, and the new event-fact `self-sacrifice` (NOT
    `self-sacrifice-graveyard`, the older zone fact it was renamed from,
    which keeps its real historical `1`) — all four are net-new facts
    authored by hand earlier this session with a typed-in `value: 1` never
    run through the real script.
  - `SYNERGY_DESIGN.md`'s weighting section got a short addendum + a flag
    that the `ease`/`strength` prose above it is stale (predates the
    single-`value` collapse) — not rewritten, out of scope for this task,
    but worth a real pass sometime.
  - `ValueBar.vue` (app/components) already had a matching `<= 0` ⇒
    "no value to show" guard by the time I got to it — a concurrent/peer
    change (not made by me), confirmed via `git status`/`git diff` showing
    it modified without my touching it. Didn't duplicate the work.
  - Verify: `npx vitest run functional-model` (216 tests) and full
    `npx vitest run` (327 passed; the only failures are
    `scripts/relations.test.mjs`'s 5 ENOENT cases, unrelated pre-existing
    cwd/tagging-pipeline issue, not touched). `verify-synergy.mjs` full
    sweep: summon-bahamut still a clean `note` (not `FAIL`); the pool's one
    `FAIL` (auron-s-inspiration, an Exile-zone trace-matching gap) is
    unrelated and pre-existing. `npm run typecheck` exits 0.
  - **Open Forge-verification**: none needed — this was a data-model/
    sentinel-value change, no rules-engine behavior touched.

- **2026-09-10 (latest+2) — two more self-referencing facts on Summon:
  Bahamut (`self-enters`, `self-sacrifice`), plus a `verify-synergy.mjs`
  refactor to support them.** Confirmed the parallel task's `self-counters`
  (LORE `putCounter`) fact had already landed in `synergy.json` before
  starting — not duplicated.
  - `self-enters`: `{event:'entersBattlefield', target:'self'}` — bare
    "enters the battlefield" label already existed in `describeFact`
    (synergy.ts:503), just unused by any fact until now. Traceable for
    free — harness.ts's `lifecycleBefore`/engine-trace.ts's
    `pilotCast`/`pilotResolveTop` already emit `{fn:'enters', zone:
    'Battlefield', ...}` for every permanent resolving onto the
    battlefield (`producedZone` already read this fn for the zone-presence
    side); the actual gap was `producedEvent` in verify-synergy.mjs having
    no case translating `fn:'enters'` into an `entersBattlefield` EVENT
    fact — added one (`{event:'entersBattlefield', side:'you'}`, matching
    `moveTo`'s existing zone==='Battlefield' case for the same event).
  - `self-sacrifice` (event fact, `{event:'sacrifice', target:'self'}`) —
    the card ALREADY had an id `self-sacrifice` for a *different*,
    pre-existing fact (a `zone:'Graveyard'` presence fact named for WHY —
    the saga's forced sacrifice — not WHAT it is). Renamed that one to
    `self-sacrifice-graveyard` and gave the new literal-sacrifice-event
    fact the (now free) `self-sacrifice` id, mirroring `self-dies`/
    `self-cast`'s own "id names the event" convention. `sacrifice`'s bare
    label already existed in `describeFact` (synergy.ts:555, from Gold
    Saucer's own cost-only sacrifice fact, 2026-09-09).
  - **Real gap found and fixed**: `producedEvent(entry, cardName)` in
    verify-synergy.mjs was a switch returning ONE `{event,...}` object per
    log entry — but `fn:'sacrifice'` already had a case producing `dies`
    (for `self-dies`-shaped facts pool-wide), and now ALSO needs to
    produce `sacrifice` (CR 701.20a — sacrificing IS dying, by a specific
    cause; both are simultaneously true of the same action). Refactored
    `producedEvent` → `producedEvents`, returning an ARRAY (every other
    case just wraps its old single object in a 1-element array; only
    `sacrifice` now returns two: `dies` AND `sacrifice`). Updated both call
    sites (forward produce-evidence check, reverse action-explained check)
    to use `.some(...)` across the array instead of a single equality
    check. Confirmed this doesn't regress `self-dies`-shaped facts
    elsewhere in the pool: Bahamut's own `self-dies` fact evidence
    actually comes from a separate `ceasesToExist`/`destroy` trace entry
    (chapter I's Treasure kill), not the `sacrifice` fn entry, and the
    full-pool sweep confirmed zero new failures pool-wide either way.
  - Verified: `verify-synergy.mjs summon-bahamut` — 0 hard failures (same
    pre-existing `tapForMana` soft notes only). Full-pool sweep — 313
    checked, 1 hard failure (still only the pre-existing unrelated
    `auron-s-inspiration`), same as always. `npx vitest run
    functional-model` — 216/216 passing, no new/changed test needed (no
    new `describeFact` branch, no new synergy.ts vocabulary — both facts
    reused existing bare-label branches). `app/lib/factConditions.ts`
    needed NO update (unlike the earlier `damage`/`recipient` case) — both
    new facts' fields (`id`/`event`/`target`/`value`/`sourceText`/
    `highlight`) are all already in its generic `HANDLED_OR_LABEL_KEYS`
    allowlist and `isSelfReferencing`'s generic `target === 'self'` check,
    so "self" renders in the notes column with no card-specific wiring.
  - **Open Forge-verification**: none needed — this is synergy/vocabulary
    plumbing (a verify-synergy.mjs reconciliation-tooling fix + fact
    authorship), not new engine mechanics; Bahamut's real `entersBattlefield`/
    `sacrifice` engine behavior was already correct and unchanged.

- **2026-09-10 (latest+1) — fixed a missed `putCounter` `target:'self'` suffix
  the earlier bare-label pass (entry directly below) didn't catch, surfaced by
  the newly-authored `self-counters` fact on summon-bahamut's own
  `synergy.json`.** That earlier pass correctly dropped `putCounter`'s
  `controller`-derived suffix ("on permanents you control"/"...an opponent
  controls") but missed a SEPARATE `target === 'self'` branch that appended
  "on itself" — no prior fact in the pool exercised `target:'self'` on a
  `putCounter` fact until summon-bahamut's `self-counters` (LORE counter,
  Saga chapter mechanic) was authored this session, so the bug was latent,
  never caught by the earlier pass's own pool-wide verification. Fixed by
  deleting the `target === 'self'` branch entirely — `putCounter` now always
  renders bare `` `${counterType} counters}`.trim() `` (e.g. "LORE counters"),
  matching `cast`'s own already-bare self-referencing treatment ("cast a
  spell", never "cast a spell on itself") exactly, per the single-dimensional
  bare-label design. Verified real before/after via the actual
  `self-counters` fact object (not a hand-typed guess): `describeFact` went
  from `"LORE counters on itself"` → `"LORE counters"`. Updated
  `synergy.test.ts`'s own `putCounter` describe block (3 assertions that
  expected the old "... on itself" suffix, including one exercising the real
  summon-bahamut shape with `controller` + `target:'self'` both present).
  Verified: `npx vitest run functional-model` 216/216 clean; full-pool
  `verify-synergy.mjs` sweep unchanged (313 checked, 7 skipped, still exactly
  1 pre-existing unrelated hard failure, `auron-s-inspiration`).
  **No Forge verification needed** — pure label-templating fix in card-facing
  text, no `interfaces.ts`/engine-mechanics change.

- **2026-09-10 (latest) — closed the last 4 inconsistent `describeFact`
  branches (`synergy.ts`) with the same bare-label treatment battlefield/
  graveyard presence, dying, damage, sacrifice, putCounter, and the generic
  fallback already got earlier this session**: `lifegain` (was
  `"${describeSide(controller)} life gain"` → now bare `'life gain'`),
  `addMana` (was `"${describeSide(controller)} mana production"` → now bare
  `'mana production'`), and a QUALIFIED zone fact (a `types`/`cmc`
  constraint on the fact's own top-level fields — `wants: {zone:
  Battlefield, types:{has:['Equipment']}}`-shaped) which used to render full
  oracle-text-style phrasing ("creature permanents you control on the
  battlefield", "creature cards in your graveyard") and now collapses to the
  exact same bare `"<zone> presence"` the unqualified case already used
  (this was flagged as a real, open exception in the function's own doc
  comment from earlier this session — now closed, not left inconsistent).
  Removed now-dead helpers this deletion made unused: `describeSide`,
  `constraintBits`, `ZONE_NOUN` (kept `ZONE_PRESENCE_PHRASE`, still used).
  `controller`/`types`/`cmc` themselves are untouched — still real, intact
  fields on every `Fact`; only the label templating changed. Confirmed via
  `app/lib/factConditions.ts` (card-owned, already generic per its own doc
  comment) that the notes/conditions column actually surfaces this detail
  for REAL non-fin/1 cards, not just checked in the abstract: Adelbert
  Steiner's own `event:'lifegain'` fact → label `'life gain'`, notes
  `'yours'`; its own qualified `{zone:Battlefield, types:{has:['Equipment']}}`
  want → label `'battlefield presence'`, notes `'yours · equipment
  permanents'`; Llanowar Elves' own `addMana` fact → label `'mana
  production'`, notes `'yours · G mana'`; Ardyn, the Usurper's own
  `{zone:Graveyard, controller:'opp', types:{has:['Creature']}}` want →
  label `'graveyard presence'`, notes `"opponent's · creature cards"`.
  `synergy.test.ts` updated to match (old qualified-zone/lifegain/addMana
  assertions rewritten to bare; the old dedicated "constraintBits / qualifier
  building" describe block for zone facts retired with a pointer to
  `factConditions.test.ts`, which already covers that constraint-rendering
  vocabulary card-side). Full pool `verify-synergy.mjs` sweep: 313 checked,
  7 skipped, 1 hard failure (`auron-s-inspiration` — confirmed via stash/
  unstash to be a PRE-EXISTING, unrelated produce/trace-evidence gap, not
  caused by this change). Full `functional-model` + `factConditions.test.ts`
  suite (235 tests) and `tsc --noEmit` both clean.
  **No Forge verification needed** — pure label-templating/vocabulary
  cleanup in card-facing text, no `interfaces.ts`/engine-mechanics change.
  All 3 remaining `describeFact`/`app/lib/factConditions.ts`-boundary items
  from `.claude/contracts/card-schema.md`'s own flagged violation ("engine-
  owned label-templating logic ... imported ... by the card page") are
  unaffected by this pass — still open, not touched here, per that
  contract's own "not urgent" framing.

- **2026-09-10 (later still) — authored the actual `self-cast` fact onto
  summon-bahamut (fin/1), the card the earlier "cast a spell" vocabulary
  research this same day was done FOR but never instantiated.** Added
  `{id:'self-cast', event:'cast', target:'self', value:1, sourceText:...}`
  as the first `source` entry in `cards/summon-bahamut/synergy.json`
  (before `self-battlefield`, matching `self-dies`/`self-sacrifice`'s own
  bare-parenthetical `sourceText` style, no `highlight`). Trace-level
  support (`harness.ts`'s `lifecycleBefore`/`engine-trace.ts`'s `pilotCast`
  logging `fn:'cast'`) was already real and unchanged — confirmed by
  regenerating `trace.json` via `run-scenarios.mjs --slug=summon-bahamut`
  (this incidentally also caught up a real, unrelated drift: the checked-in
  trace.json still had the second "forced self-destroy" scenario that
  `scenarios.ts`'s own comment already documented as removed earlier this
  session — regenerating dropped it, a legitimate catch-up, not caused by
  this fact).
  **Real gap found and fixed in `verify-synergy.mjs` (not just `synergy.json`
  authorship)**: a bare self-referencing `{event:'cast'}` SOURCE fact is a
  produce fact, verified through the file's forward "every declared produce
  needs supporting trace evidence" path (`producedEvent()`), not through
  `TRIGGER_EVENT_MAP` (that map is want/trigger-name evidence only, and no
  trigger name is involved here at all) — but `producedEvent()` had no
  `case 'cast'` branch (only `IGNORED_FNS` had `'cast'`, which just
  exempts it from the unrelated REVERSE "explain every action" soft-note
  pass), so the fact would have hard-failed verification with zero engine
  changes. Added `case 'cast': return { event: 'cast', side: 'you' };` to
  `producedEvent()` (scripts/verify-synergy.mjs), mirroring `playLand`'s own
  unconditional `side:'you'` immediately above it (harness/engine-trace's
  own `cast` log line carries no `controller`/`player` field — it's always
  the scenario's own 'you' pilot casting the card under test). Verified:
  `verify-synergy.mjs summon-bahamut` → 0 hard failures (only pre-existing,
  unrelated soft notes: `tapForMana`, LORE `putCounter`); full-pool run →
  same single pre-existing hard failure as before my change
  (`auron-s-inspiration`'s unrelated Exile-zone produce gap, confirmed via
  `git stash` that it predates this change) — my `producedEvent` addition
  is event-only and provably can't touch that card's zone-shaped failure.
  Full suite (222 tests) + `tsc --noEmit` clean.
  Confirmed live: `/api/card/fin/1`'s `functionalModel.synergy.source[0]`
  now serves the `self-cast` fact, and `describeFact(fact)` returns
  `"cast a spell"` directly (the bare, flat label per this session's
  single-dimensional design decision above — no creature/noncreature
  variation). **Not independently confirmed in an actual browser render**
  (no screenshot/browser tool available to this specialist) — verification
  is via the same API response + `describeFact()` call the Facts tab
  itself consumes, which is the full data contract the UI renders from;
  the card agent/orchestrator should do a final visual pass if a literal
  screenshot is wanted.
  **Open Forge-verification**: none needed — this is a synergy-vocabulary/
  verification-script addition, not new engine mechanics; the underlying
  `cast` lifecycle behavior (`harness.ts`/`engine-trace.ts`) was already
  correct and untouched.


- **2026-09-10 (yet later same day): user decided the Facts-tab label design
  is fully bare/single-dimensional — this PARTIALLY REVERSES the very next
  entry below (`cast`/`dies` fix) AND the "damage direction"/"either
  player's" side-prefix work from the task before that one.** Every
  `describeFact` label is now just the bare category noun/phrase for its
  zone/event kind ("battlefield presence", "dying", "damage", "graveyard
  presence", "sacrifice", plain `event` string) — no `describeSide`/
  `'your '`/`"opponent's"` WHO-prefix, and (per an explicit mid-task
  correction from the coordinator) no type-derived WHAT-KIND-noun either
  (a `dies` fact with `target:{types:{not:['Land']}}}` now renders "dying",
  not "nonland permanent dying"). Underlying `controller`/`recipient`/
  `target` fact DATA is untouched — a parallel `card`-agent task
  (`app/lib/factConditions.ts`) surfaces that in the notes/conditions column
  instead. Branches touched: zone-presence unqualified (bare `<zone>
  presence` regardless of `controller`), `dies` (always bare "dying"),
  `putCounter` (dropped the `controller`-derived "on permanents you
  control"/"...an opponent controls" suffix; KEPT `counterType`, e.g. "+1/+1
  counters" — treated as the counter's own real mechanic/category, not a
  who/what-kind qualifier, matching the orchestrator's own explicit
  instruction on this one field), `damage` (bare "damage", dropped both the
  dealer prefix and `recipient` "to the opponent"/"to you" suffix),
  `sacrifice` (bare "sacrifice", dropped both the `controller` prefix and
  its `types`-qualifier, e.g. "artifact sacrifice" → "sacrifice"), and the
  generic fallback (bare `event` string only, e.g. "land landfall" →
  "landfall"). `describeSide()` itself (including its `undefined` →
  "either player's" fallback) was NOT deleted — still genuinely used by
  `lifegain`, `addMana`, and the qualified non-Battlefield zone branch (`...
  in your/an opponent's/either player's <zone>`), none of which this task
  touched (see open question below). fin/1 (Summon: Bahamut) verified
  before/after via a real script run against `synergy.json` (not just
  reasoned about) — see PR/diff for the exact 8-fact table.
  - **Deliberately left untouched, flagged as an open follow-up, not
    silently inconsistent**: `lifegain`/`addMana`'s own `describeSide`
    prefix (e.g. "your life gain", "an opponent's mana production") and the
    qualified-zone branches' own type+control phrasing (e.g. "creature
    permanents you control on the battlefield", "creature cards in your
    graveyard") both predate this session entirely and were never in this
    task's explicit branch list — left as-is rather than unilaterally
    expanding scope, but they're now visibly inconsistent with every other
    label in the same Facts-tab column being fully bare. Worth a real
    follow-up decision: either extend the same bare-label treatment to
    these two remaining spots, or explicitly accept zone-with-type-
    constraint and lifegain/addMana as permanent exceptions.
  - Updated `synergy.test.ts` assertions for every touched branch (the
    zone-presence "you"/"opp" tests, `dies`, `putCounter`'s controller
    suffix test, `sacrifice`, the generic-fallback/landfall test, and the
    whole `damage` describe block) to expect the new bare output; did NOT
    touch `lifegain`/`addMana`/qualified-zone tests (untouched branches).
    Full suite green: `npx vitest run functional-model/` → 222/222 passed.
    `npx tsc --noEmit -p functional-model/tsconfig.json` shows the exact
    same pre-existing errors before and after this change (verified via
    `git stash`) — all in unrelated card `definition.ts` files
    (`.ts`-import-extension TS5097, implicit-any TS7034/7005) and
    `synergy.test.ts` lines 28-74 (an unrelated `event`-property-typing
    issue in a different describe block, pre-existing) — zero new errors
    introduced.

- **2026-09-10 (later same day): added a generic `cast` event kind +
  fixed two `describeFact` mislabels found live on fin/1 (Summon: Bahamut),
  scoped ONLY to `synergy.ts`/`synergy.test.ts` per explicit orchestrator
  instruction (no other cards, no `verify-synergy.mjs` `TRIGGER_EVENT_MAP`
  wiring, no retroactive per-card authoring — all deferred).**
  - **`cast`**: `EventFact.event` was already a loose `string` (confirmed,
    no type change needed) — added ONE `describeFact` branch,
    `if (event === 'cast') return 'cast a spell';`, deliberately flat and
    ignoring any `Constraints.types`/`target` the fact might carry for
    WORDING purposes (type-specificity for a future sink — "wants
    specifically a creature spell cast" — stays real MATCHING data, per
    the user's own explicit "Creature and whatnot is not needed here"
    instruction). No card's `synergy.json` authored with `cast` yet — this
    is vocabulary-only, for fin/1's own future use. Existing
    `castCreatureSpell`/`castNoncreatureSpell`-shaped camelCase event
    strings elsewhere in the pool are UNRELATED and untouched.
  - **`dies` mislabel (real bug, not fin/1-specific)**: `describeFact`'s
    `dies` branch hardcoded the noun "creature" regardless of what the
    fact's own `target` `Constraints` object actually said — Summon:
    Bahamut's `destroy-nonland` fact (`target:{types:{not:['Land']}}}`,
    i.e. "destroy up to one target NONLAND permanent") rendered as "either
    player's creature dying", never mentioning Creature at all. Fixed by
    deriving the qualifier/noun from `fact.target` via the SAME
    `constraintBits` helper every zone-fact label already reuses (not a
    one-off string) — a `target` constraint present widens the noun to
    "permanent" (dies is CR-glossary creature-only by default, so an
    absent/bare target still says "creature", unchanged); a real
    `types.not` constraint renders "nonland"/"noncreature nonland" etc.
    **Root cause was one level deeper than just the `dies` branch**:
    `constraintBits` itself had NO `not`-handling at all (only
    `has`/`hasAny`/`cmc`) — so every OTHER card in the pool with a
    `types.not` constraint directly on a zone/event fact (not under
    `target`) was ALSO silently losing that qualifier from its label
    (checked via `grep '"not"' cards/*/synergy.json`: lunatic-pandora,
    white-auracite, summon-esper-ramuh, elrond-moon-reader, elixir,
    the-emperor-of-palamecia-the-lord-master-of-hell,
    venat-heart-of-hydaelyn-hydaelyn-the-mothercrystal,
    fate-of-the-sun-cryst — e.g. lunatic-pandora's sink `{types:{not:
    ['Land']}}}` rendered as bare "battlefield presence" before this fix,
    now "nonland permanents on the battlefield"). Added the generic `not`
    case to `constraintBits` itself (`non${type.toLowerCase()}`, joined
    per type — "nonland", "noncreature nonland" for a 2-item list), which
    is what actually fixed ALL of the above, `dies` included — this is a
    shared-code fix with pool-wide label-rendering fallout, NOT retroactive
    per-card `synergy.json` authoring (no `.json` files touched, only
    `synergy.ts`'s rendering function) — flagged in case the pool-wide
    rendering change itself needs a second look.
  - **`damage` fact direction — flagged back, NOT fixed, per explicit
    instruction not to invent schema on my own judgment.** Checked every
    real `event:'damage'` fact in the pool (23 cards): `controller` is
    `'you'` on 100% of them — it names the CASTER's side, never the
    recipient. There is no field anywhere on `EventFact` capturing "which
    player receives the damage" (`target` is `'self'|Constraints`, used
    for TARGETED-creature filters like Nibelheim Aflame/Self-Destruct's own
    `target:{types:{has:['Creature']}}}` — there's no way to express "the
    opponent player" as a `Constraints`-satisfying object, `Constraints`
    only describes card/permanent objects). Bahamut's own Mega Flare fact
    (`{event:'damage', controller:'you'}`) genuinely cannot say "to each
    opponent" today — the data doesn't carry it, so the label can't either
    without inventing a new field. **Note this is a real, load-bearing
    inconsistency worth the user's attention**: `lifeloss`'s own
    `controller` already means the OPPOSITE thing pool-wide (the RECIPIENT
    — summon-primal-odin's own two `lifeloss` facts, `controller:'you'`/
    `'opp'`, model "each player loses life" as two distinct facts keyed by
    who loses) — so `damage.controller` and `lifeloss.controller` are two
    different semantics under the same field name today. Left the
    `damage` fact/label completely untouched pending the user's own call
    on how to extend the schema (a `recipient?: Side` field on `EventFact`,
    reusing `target` some new way, or something else) — flagging rather
    than picking one unilaterally, per the task's own explicit instruction.
  - **Verified**: `npx vitest run functional-model` 224/224 (was 219 before
    this session's earlier controller-phrasing pass + this pass's own 5 new
    assertions: 3 for `dies`+target-constraint, 1 for `cast`, 1 for
    `constraintBits`'s `not` case — all passed on the FIRST run). Full-pool
    `verify-synergy.mjs` sweep unchanged (still exactly 1 pre-existing
    unrelated hard failure, `auron-s-inspiration`; summon-bahamut's own
    pre-existing soft notes — 9 `tapForMana`, 4 LORE `putCounter` —
    byte-identical). `tsc --noEmit -p functional-model/tsconfig.json`: 50
    errors before AND after (confirmed via a throwaway reconstructed
    "before" copy of `synergy.ts`, NOT `git stash` — today's working tree
    already carries substantial uncommitted engine work from earlier
    sessions today, predating this task, so a straight `git stash`/HEAD
    diff would have wrongly reverted THAT too; used a hand-reconstructed
    pre-edit copy of `describeFact`/`constraintBits` instead, scratchpad
    `synergy-before.ts`, to get a true isolated before/after for fin/1's
    own Facts). Real regenerated fin/1 (Summon: Bahamut) Facts, both real,
    via `describeFact` against the actual unmodified `synergy.json` (no
    `.json`/`definition.ts`/`scenarios.ts` touched, so no `trace.json`
    regeneration needed):
    - `destroy-nonland`: `"either player's creature dying"` → `"either
      player's nonland permanent dying"`
    - `chapter-iv-damage`: `"your damage"` → unchanged (flagged above)
    - `cast a spell`: new vocabulary, not yet used by any fact
    - every other fin/1 fact unchanged (`self-battlefield`,
      `chapter-iii-draw`, `self-sacrifice`, `self-dies`, `mega-flare-you`,
      `mega-flare-opp`).
  - Open Forge-verification: none — pure synergy-matching label/vocabulary
    change, no rules-engine behavior touched.

- **2026-09-10: removed `summon-bahamut`'s second scenario (forced
  self-destroy corner case) on the user's own call that it added no
  distinct coverage.** Checked before deleting, per the scenario-content
  rule: the only genuinely NEW thing scenario B exercised vs scenario A
  was chapter I's "destroy" targeting Bahamut itself when it's the sole
  legal nonland permanent on an otherwise-empty board (scenario A instead
  has chapter I hit a real opponent Treasure via `preferTarget`, then
  chapter II decline). Verified via `verify-synergy.mjs` internals
  (`producedEvent`'s `ceasesToExist`/zone==='Graveyard' case) that the
  synergy.json `destroy-nonland` source fact (`{event:'dies',
  target:{types:{not:['Land']}}}`, no `controller`) is side-agnostic —
  scenario A's own Treasure kill (logged as `ceasesToExist`, not
  `destroy`, per 704.5d) already fully backs it, so scenario B's unique
  `fn:'destroy'` log line was never load-bearing evidence. Removed
  `scenarioB` from `functional-model/cards/summon-bahamut/scenarios.ts`,
  regenerated `trace.json` via `run-scenarios.mjs --slug=summon-bahamut`
  (1 scenario now, was 2). `synergy.json` untouched (hand-authored,
  unaffected). Confirmed via `git stash`/pop diff that
  `verify-synergy.mjs`'s summon-bahamut soft-note set (9 pre-existing
  `tapForMana`-unrecognized + 4 pre-existing `putCounter`/LORE-unmatched
  notes) is byte-identical before/after — no new failures, full-pool sweep
  unchanged (still only the 1 pre-existing unrelated `auron-s-inspiration`
  hard failure), `npx vitest run functional-model` 219/219 unchanged.

- **2026-09-10: `describeFact()`'s `controller` phrasing made explicit
  everywhere — display-string change only, matching logic (`Side`,
  `sidesCompatible`, `effectiveController`) untouched.** Root problem: an
  unqualified zone-presence fact with `controller:'you'` was rendering
  IDENTICALLY to one with `controller` omitted ("battlefield presence"
  either way) — a real, silent collapse, not just a stylistic gap. Also
  found (via a full-pool grep, not guesswork) that `controller` was being
  read for zone/`putCounter`/`sacrifice` facts but completely IGNORED by
  a huge swath of event facts falling through the generic
  `` `${qualifier}${event}` `` fallback — `damage` (23 facts),
  `grantKeyword` (20), `lifeloss` (18), `landfall` (9), plus
  `graveyardLeaves`/`castCreatureSpell`/`scry`/`surveil` — 73 of 75 such
  facts in the pool DO declare a real `controller` that was silently
  dropped. Worst concrete case: `summon-primal-odin` has two `lifeloss`
  facts, `controller:'you'` and `controller:'opp'` (Odin's own "each
  player loses X life" modeled as two distinct facts) — both rendered as
  the bare, indistinguishable string `"lifeloss"` before this fix.
  - Changes, all in `functional-model/synergy.ts`:
    - Unqualified zone-presence branch: added the missing `controller ===
      'you'` case (`` `your ${presence}` ``) alongside the existing `'opp'`
      case; omitted stays bare (means "either player," now genuinely
      distinct from `'you'` instead of colliding with it).
    - `describeSide()`'s undefined-controller fallback changed from bare
      `'a'` (ambiguous — "a graveyard" reads like "some specific unstated
      graveyard," not clearly "either") to `"either player's"` — feeds
      `lifegain`/`dies`/`addMana`/non-Battlefield-qualified-zone labels.
    - `putCounter` branch: added a `controller`-aware suffix (`" on
      permanents you control"` / `" on permanents an opponent controls"`)
      for the non-`target:'self'` case — `controller` here names who
      controls the RECIPIENT permanent (Minwu's "each Cleric you control,"
      Ice Flan's opponent-controlled stun target), not the caster; used
      `"permanents"` not `"creatures"` since Clash of the Eikons's own LORE
      counters target a Saga, not a creature (same reason the `target`
      type constraint itself stays unrendered — see this function's own
      doc comment).
    - `sacrifice` branch: added the same `"your "`/`"opponent's "` prefix
      every other branch now has (only `'you'` exists in the pool today,
      but the label shouldn't silently drop a future `'opp'` one either).
    - Generic fallback (everything not explicitly branched — `damage`,
      `lifeloss`, `grantKeyword`, `landfall`, etc.): added the same
      `"your "`/`"opponent's "` prefix; bare stays reserved for a fact that
      genuinely omits `controller` (Louisoix's Sacrifice's own
      side-agnostic `counter` event, e.g.), not a silent default.
    - Explicitly did NOT touch `activateAbility`/`entersBattlefield`/
      `playLand`/`coinFlip`/`drawCard`/`drawCards` — every real
      `controller` on these events is `'you'` (100% of the pool, no `'opp'`
      example exists) AND the event is inherently self-scoped (`subject:
      'self'`/an ability of the card's own), so `controller` there is a
      tautological annotation, not a discriminator the way it is for
      zone-presence/`putCounter`/the generic fallback's own events, and a
      grammatical rewrite like "your enters the battlefield" would be a
      real wording redesign, not the "display-string change ONLY" this
      task asked for. Flagging in case a future card breaks that 100%
      assumption.
  - Test updates in `functional-model/synergy.test.ts`: fixed the ONE test
    (`Battlefield — controller "you"`) that was asserting the OLD collapsed
    behavior as correct-by-design ("you is the default, stays unstated" —
    that was the bug, not a real design choice, despite reading like one);
    updated every other test asserting the old bare `'a'`/no-prefix
    behavior for a genuinely-undefined controller to the new
    `"either player's"` phrasing; added new real-shape coverage for
    `putCounter`+`controller` (Minwu/Ice Flan shapes), `sacrifice`+`'opp'`,
    and the generic fallback's `lifeloss`/`damage` (previously zero
    coverage of controller on any of these). All net-new/updated
    assertions describe real card shapes already in the pool, not invented
    ones.
  - Verified: `npx vitest run functional-model` 221/221 (219 prior + 2 net
    new), full `npm run test` unchanged (same 5 pre-existing unrelated
    `tagging/*` failures), `verify-synergy.mjs` full-pool sweep unchanged
    (still exactly 1 pre-existing unrelated hard failure,
    `auron-s-inspiration` — label rendering isn't part of what it checks
    anyway, matching logic wasn't touched), `tsc --noEmit -p
    functional-model/tsconfig.json` — exactly 50 errors before AND after
    (confirmed via `git stash`/pop diff on the error count) — zero new type
    errors. Also confirmed real before/after label output via a throwaway
    `vite-node` script (not hand-typed) reading actual `synergy.json` for
    `minwu-white-mage`/`ice-flan`/`the-gold-saucer`/`clash-of-the-eikons`/
    `golbez-crystal-collector`/`summon-primal-odin` through both the old
    (stashed) and new `describeFact` — e.g. `summon-primal-odin`'s two
    `lifeloss` facts went from both-identical `"lifeloss"` to distinct
    `"your lifeloss"` / `"opponent's lifeloss"`.
  - Open Forge-verification: none — pure display-string wording, no rules
    behavior or fact schema touched.

- **2026-09-09 (Gold Saucer, fourth follow-up): 3 annotation gaps + 1 new
  fact, per user's own card-page review** — (1) `mana` fact's `highlight`
  widened `"{C}"` → `"Add {C}"`. (2) both Treasure-token facts
  (battlefield-presence, entersBattlefield) got `sourceText`/`highlight`
  added (same `sourceText` as `coin-flip`, `highlight:"create a Treasure
  token"`) — previously had neither. (3) new `source` fact:
  `{event:'sacrifice', controller:'you', types:{has:['Artifact']}, ...}` —
  the ACT of sacrificing, parallel to how `coinFlip` models the
  deterministic flip separately from its outcome; distinct from the
  existing `Battlefield`/`types:{has:['Artifact']}` sink fact (wants vs.
  performs). Also gave the sink fact a `highlight:"two artifacts"` it
  didn't have before.
  - `describeFact` got a new `sacrifice` branch: `` `${qualifier}sacrifice`.trim() ``
    — deliberately reuses the shared `constraintBits` qualifier machinery
    instead of hardcoding "artifact," so it renders "artifact sacrifice"
    for Gold Saucer's own `types:{has:['Artifact']}` and stays correct for
    a differently-typed sacrifice on some future card. Verified directly
    (real fact object → "artifact sacrifice") and via 2 new
    `synergy.test.ts` assertions (with/without a `types` qualifier),
    folded into the `describeFact` coverage added earlier this session.
  - `verify-synergy.mjs` got `isCostOnlyArtifactSacrificeFact` — the
    produce-side sibling of `isCostOnlyArtifactSacrificeWant`, reusing the
    exact same `hasCostOnlyArtifactSacrifice` predicate, scoped identically
    (only `{event:'sacrifice', types:{has:['Artifact']}}` on a card whose
    sacrifice cost is genuinely unmodeled as a real effect — a card whose
    sacrifice IS modeled, e.g. ahriman/phantom-train/quina-qu-gourmet,
    still needs real trace evidence for its own `sacrifice` fact, no
    change there).
  - Re-verified: `the-gold-saucer` OK on its own, full `verify-synergy.mjs`
    sweep unchanged (still 1 pre-existing unrelated hard failure,
    auron-s-inspiration), `npx vitest run functional-model` 219/219 (218
    prior + 1 new test), full `npm run test` unchanged (same 5
    pre-existing unrelated `tagging/*` failures).

- **2026-09-09: added real unit test coverage for `describeFact`
  (`functional-model/synergy.ts`) to `functional-model/synergy.test.ts`** —
  previously ZERO tests existed for it despite it being hand-fixed via
  manual browser inspection 4 times this session (`playLand` trailing
  period, `entersBattlefield` tapped-redundancy, `types.has`
  capitalization, `coinFlip` label). Covers every branch: all 6 zones'
  unconstrained "<zone> presence" phrasing (incl. the Exile
  `ZONE_PRESENCE_PHRASE` override and confirming it does NOT apply once a
  qualifier is present), the Battlefield-with-control-qualifier branch, the
  non-Battlefield qualified branch, every named event (`lifegain`, `dies`
  both target shapes, `putCounter` with/without `target:'self'`/
  `counterType`, `drawCard`/`drawCards`, `entersBattlefield`, `playLand`,
  `activateAbility`, `addMana`, `coinFlip`), the generic
  `${qualifier}${event}` fallback, and `constraintBits` (`types.has`
  lowercased, `types.hasAny` parenthesized-original-casing, `cmc` min/max/eq
  variants). Also added a bulk "label convention" regression guard (every
  representative fact's label matches `/^[a-z(]/` and never ends in
  `.`/`!`/`?`) plus two explicit non-leak assertions (`addMana` never
  contains its own color letters, `entersBattlefield` never contains
  "tap") — this is what would have caught all 4 of this session's
  hand-fixed bugs automatically. `zf`/`ef` are tiny local fixture builders
  (id/role are irrelevant to `describeFact` itself). All 42 new
  assertions passed on the FIRST run (confirms the derivations matched
  the real implementation, not a rewrite-to-fit). Verified: `npx vitest
  run functional-model` 218/218 (181 prior + 37 new test cases — the
  existing 5 `EventFact.colors` tests were already in the 181), full
  `npm run test` unchanged (same 5 pre-existing unrelated `tagging/*`
  failures). Confirmed via `tsc --noEmit` that the new test block adds
  zero NEW type errors (the file already had 7 pre-existing ones in the
  untouched `EventFact.colors` block, unrelated to my new code, unchanged
  before/after).

- **2026-09-09 (later same day): added explicit, author-set `Fact.face?: 'front'
  | 'back'` to `synergy.ts` and backfilled it on every real multi-face card's
  synergy.json** — replaces the card page's own (peer `card`-agent-owned)
  oracle-text-matching heuristic for grouping a multi-face card's Facts table
  into "Main card"/"Other faces," which was confirmed WRONG for
  `sidequest-catch-a-fish-cooking-campsite`'s own front-face upkeep-trigger
  sink fact (its authored `sourceText` had a trailing "..." never in the real
  Scryfall oracle text, so the fact silently matched NEITHER face and fell
  into the fallback bucket despite genuinely belonging to the front face).
  **Shape chosen: `'front'|'back'` string, not a numeric faces-array index**
  — deliberately reused harness.ts's own pre-existing `Scenario.face`/
  `SequenceStep.face` vocabulary (same field name, same two values) rather
  than inventing a parallel numbering scheme, since `'front'` always maps to
  a card's own top-level `CardDefinition` and `'back'` to `.backFace` (see
  card.ts) — the same objects `resolveSubject('self', ...)` and
  `Scenario`'s own face-selection already treat as canonical. A future
  `card`-agent consumer maps `'front'`→`faces[0]`/`'back'`→`faces[1]`
  trivially. Field is on BOTH `ZoneFact` and `EventFact` (documented once in
  full on `ZoneFact`, `EventFact`'s copy is a `@see` shorthand, matching the
  existing `sourceText`/`highlight` convention) — NOT matched against
  anything by `factsInteract`/`themeOf` (purely documentary/rendering, same
  treatment as `sourceText`), so this is a genuinely additive, non-breaking
  schema change (confirmed: `npm run typecheck`, `vitest run functional-model`
  181/181, full-pool `verify-synergy.mjs` sweep all unchanged except the
  new-but-unenforced `face` field itself — same single pre-existing
  `auron-s-inspiration` hard failure as before this pass).
  **Discovery: 33 real multi-face cards exist in the pool** (every
  `definition.ts` that declares a real `backFace`), not just the 6 named in
  the task brief — found via `grep -rl backFace cards/*/definition.ts` (37
  hits), then hand-verified 4 were false positives (`fang-fearless-l-cie`,
  `summon-brynhildr`, `summon-fat-chocobo`, `summon-leviathan` — each only
  MENTIONS `backFace` in a comment citing another card, or explicitly
  documents NOT using it for its own real mechanic). Backfilled `face` on
  every fact in all 33 real ones' `synergy.json`, hand-classified per card by
  reading its own `definition.ts` (which effect/trigger actually produces or
  wants each fact — front's own top-level `triggers`/`effects` vs.
  `backFace`'s), not by re-running the same broken sourceText-matching
  heuristic this task exists to replace. Full list: balamb-garden-seed-
  academy-balamb-garden-airborne, cecil-dark-knight-cecil-redeemed-paladin,
  clive-ifrit-s-dominant-ifrit-warden-of-inferno, crystal-fragments-summon-
  alexander, dion-bahamut-s-dominant-bahamut-warden-of-light, emet-selch-
  unsundered-hades-sorcerer-of-eld, esper-origins-summon-esper-maduin,
  exdeath-void-warlock-neo-exdeath-dimension-s-end, garland-knight-of-
  cornelia-chaos-the-endless, ishgard-the-holy-see-faith-grief, jecht-
  reluctant-guardian-braska-s-final-aeon, jidoor-aristocratic-capital-
  overture, jill-shiva-s-dominant-shiva-warden-of-ice, joshua-phoenix-s-
  dominant-phoenix-warden-of-fire, kefka-court-mage-kefka-ruler-of-ruin,
  kuja-genome-sorcerer-trance-kuja-fate-defied, lindblum-industrial-
  regency-mage-siege, midgar-city-of-mako-reactor-raid, sephiroth-fabled-
  soldier-sephiroth-one-winged-angel, serah-farron-crystallized-serah,
  sidequest-card-collection-magicked-card, sidequest-catch-a-fish-cooking-
  campsite, sidequest-hunt-the-mark-yiazmat-ultimate-mark, sidequest-play-
  blitzball-world-champion-celestial-weapon, sidequest-raise-a-chocobo-
  black-chocobo, terra-magical-adept-esper-terra, the-emperor-of-palamecia-
  the-lord-master-of-hell, thranduil-sindarin-liege-silvan-rally, ultimecia-
  time-sorceress-ultimecia-omnipotent, venat-heart-of-hydaelyn-hydaelyn-
  the-mothercrystal, vincent-valentine-galian-beast, zanarkand-ancient-
  metropolis-lasting-fayth, zenos-yae-galvus-shinryu-transcendent-rival.
  **Generic "baseline" self facts (self-battlefield-presence/self-graveyard/
  self-dies with no real ability text) were assigned `'front'` by
  convention** — they're true regardless of which face is showing but
  `resolveSubject('self', ...)`/every other "which identity is canonical"
  convention in this file already treats the top-level `CardDefinition` as
  the default, so `'front'` for a genuinely face-agnostic baseline fact is
  consistent, not arbitrary.
  **Two genuinely ambiguous cards, flagged rather than silently resolved**:
  `sephiroth-fabled-soldier-sephiroth-one-winged-angel` and (one fact of)
  `sidequest-play-blitzball-world-champion-celestial-weapon` have a real
  mechanic DUPLICATED near-identically on both faces (Sephiroth: both front's
  `onCreatureDies` and back's `onAnyCreatureDies` are the same "any creature
  dies → opponents lose 1, you gain 1" shape; Blitzball: front's
  `pumpTarget` and back's Equip both equally want "a creature you control").
  A single `face` value can't represent "true of both" — picked `'front'`
  for all of Sephiroth's shared facts and the one shared Blitzball sink,
  consistent with the baseline-fact tie-break above, but this is a real
  approximation, not a clean single-face fact — worth a second look if the
  `card` page's own consumer ever needs to actually disambiguate these two
  specifically.
  **Contract file checked, not touched**: `.claude/contracts/card-schema.md`
  documents `synergy.json` only at the "source/sink facts" level, never
  enumerating `Fact`'s own internal field list — silent on this exactly the
  way it's silent on `id`/`sourceText`/`highlight` too, so no edit was
  needed; flagging per the task's own ask rather than assuming silence
  meant "forgot to check."
  **Explicitly did NOT touch** `app/pages/app/card/[set]/[number].vue` or
  `app/components/ReviewStatusBadge.vue` — a peer `card`-agent task owns
  wiring the page's grouping logic to read `fact.face` directly instead of
  its current oracle-text-heuristic; this pass is schema+data only.
  Open Forge-verification: none — this is a pure schema/authoring-metadata
  change, no rules-engine behavior touched, so no new Forge citation
  applies (every underlying `Effect`/`trigger` this pass read from was
  already Forge-cited in its own `definition.ts` from earlier sessions).


- **2026-09-09 (follow-up to the Town-cycle pass below): extended `mana.ts`'s
  `ManaColor` to include colorless (`C`) as a real value through the SAME
  WUBRG code path** (`manaAbilityColorFromStaticText`/
  `manaAbilityColorsFromStaticText` regexes widened to `[WUBRGC]`), per
  explicit user request — no longer deferred. Deliberately did NOT widen
  `COLORS`/`parseManaCost` (still WUBRG-only) — a permanent's mana ABILITY
  producing `C` is a different question from a SPELL's own cost containing
  a literal `{C}` pip, and only the former was asked for; the latter stays
  a real, separately-scoped, unchanged gap. `LAND_FOR_COLOR` had to become
  `Partial<Record<ManaColor,...>>` (TS exhaustiveness) since no basic land
  produces colorless here. Wrote the-gold-saucer's real `mana` fact
  (`color:'C'`) off this — now covered by the PRE-EXISTING addMana static
  exemption automatically, no new verify-synergy.mjs logic needed for this
  part (unlike crossroads-village's separate "choose a color" exemption).
  Updated mana.test.ts (1 pre-existing test asserted the OLD "not
  recognized" behavior — updated it to the new expectation, added 2 more
  cases). Checked blast radius before running full tests: none of the 6
  real "{T}: Add {C}." lands (capital-city/cavern-of-souls/starting-town/
  eclipsed-realms/clive-s-hideaway/the-gold-saucer) appear as filler in any
  OTHER card's or keyword bundle's scenarios.ts, so the only place
  `manaAbility='C'` newly flowing into `canAfford`'s generic-mana-coverage
  check could matter is each such card's own scenario (none of which
  invoke `canAfford`/`payMana` at all — confirmed). Verified broadly per
  the user's own ask: `npx vitest run functional-model` 181/181, full
  `npm run test` unchanged except the 3 new/updated mana tests (still the
  same 5 pre-existing unrelated `tagging/*`-missing-file failures), full
  `verify-synergy.mjs` sweep still exactly 1 pre-existing unrelated hard
  failure (auron-s-inspiration).
  - **Coin-flip/Treasure fact — proposed, NOT written, flagged back
    unresolved** (genuinely two options, not silently decided): checked
    for precedent — edgar-king-of-figaro's own "Two-Headed Coin" static
    ability gets NO fact at all, and Gold Saucer is the only OTHER
    coin/die-roll card in the whole pool, so there is zero precedent for a
    probabilistic-only ability getting any fact, atypical/low-value or
    otherwise. Structurally: `synergy.ts`'s `Fact`/`EventFact` has no field
    for "conditional/probabilistic, not guaranteed" — `value` (1-5) is
    explicitly documented as trace-computed MAGNITUDE only, not a
    certainty dimension, so repurposing a low `value` to mean "50/50"
    would conflate two different axes dishonestly. Mechanically: no
    scenario could ever produce real trace evidence for a `createToken`
    fact here without either (a) fabricating an unconditional Treasure-
    creation effect in definition.ts (directly contradicting that file's
    own explicit reasoning for why this stays static text, and going
    beyond "already correct, don't rewrite"), or (b) hard-failing
    verify-synergy.mjs (no exemption function of this shape exists, unlike
    the "known statically TRUE" exemptions elsewhere, which are the
    opposite justification). Two options laid out for the orchestrator/
    user rather than picked solo: (A) no fact at all (matches every
    existing precedent + the reconciliation design's own invariants,
    recommended), or (B) add a genuinely NEW schema capability
    (`probabilistic?: boolean` or similar on `EventFact`, PLUS a new
    verify-synergy.mjs exemption for it) — a pool-wide design decision
    that reaches beyond this one card, not something to introduce
    unilaterally for one card's sake.
  - **RESOLVED same day, per explicit user correction**: the ask was never
    about the probabilistic Treasure OUTCOME — it's about the coin FLIP
    itself, which the user correctly pointed out is NOT probabilistic at
    all: activating the ability always performs a flip, guaranteed by its
    own printed text, same class of claim as `playLand`/
    `entersBattlefield`. Wrote a real `{id:'coin-flip', event:'coinFlip',
    controller:'you', ...}` source fact (`EventFact.event` is already
    plain `string`, zero synergy.ts type change needed for the field
    itself). Two things this NEW event value needed, both added:
    1. `synergy.ts`'s `describeFact` — added a real `'coin flip'` label
       branch (would otherwise fall through to the generic `${event}`
       fallback and render literally as "coinFlip").
    2. `verify-synergy.mjs` — needed a NEW static exemption
       (`hasCoinFlipAbility`/`isCoinFlipFact`, right after
       `isSelfBattlefieldPresenceLand`, wired into the forward per-fact
       check next to `isSelfPlayableLand`): the flip's own occurrence is
       tautologically guaranteed by the ability's printed "Flip a coin"
       text existing at all (same reasoning class as
       `isSelfPlayableLand`/`isLandEntersTappedSelfFact`), so no
       scenario/trace evidence should be required — none could ever exist
       anyway (no coin-flip mechanism in this engine). Scoped to an exact
       "Flip a coin" substring match, since Gold Saucer is the only
       coin-flip card in the whole 313-card pool (checked) — no
       speculative generality added for a mechanism nobody else needs yet.
  - Re-verified after this closing round: `the-gold-saucer` OK on its own,
    full `verify-synergy.mjs` sweep unchanged (still 1 pre-existing
    unrelated hard failure, auron-s-inspiration), `npx vitest run
    functional-model` 181/181, full `npm run test` unchanged (same 5
    pre-existing unrelated `tagging/*` failures).
  - **Label wording follow-up**: `describeFact`'s `coinFlip` branch was
    initially `'coin flip'` (noun phrase) — corrected to `'flip a coin'`
    (verb phrase) per explicit user request, matching the `playLand`→
    `'play a land'` convention already established this session. Just the
    string, no other change.
  - **Third follow-up, same day — 3 more Gold Saucer facts requested from
    the card page directly**: (1) self battlefield-presence — already
    present, confirmed, untouched. (2) Treasure token's OWN battlefield
    presence — added `{zone:'Battlefield', controller:'you',
    subject:{token:'c_a_treasure_sac'}, value:1}`, mirroring
    zanarkand-ancient-metropolis-lasting-fayth's own Hero-token fact shape
    exactly (no id/sourceText) per the user's own explicit instruction —
    tracked as real regardless of the coin flip's outcome uncertainty,
    same "we don't care about probabilistic" stance as the coinFlip fact
    itself. (3) Treasure's ETB — added `{event:'entersBattlefield',
    controller:'you', subject:{token:'c_a_treasure_sac'}, value:1}` — a
    genuinely NEW pattern (checked: no other card in the pool has an
    `entersBattlefield` fact with a token subject, source OR sink side).
    (4) artifact-sacrifice sink, the one I'd previously recommended
    NOT adding — user explicitly overrode that; added
    `{zone:'Battlefield', controller:'you', types:{has:['Artifact']},
    value:1}`, matching ahriman/phantom-train/quina-qu-gourmet's own
    precedent shape (no id/sourceText).
  - New `verify-synergy.mjs` exemptions needed for (2)+(3)+(4), since none
    could ever get real trace evidence (no coin-flip mechanism, and the
    sacrifice cost is never modeled as a real effect — same reasoning as
    before, now deliberately overridden by explicit user instruction, not
    silently reversed):
    - `isCoinFlipTokenSubjectFact` (covers both (2) and (3), zone- or
      event-shaped either way) — gated specifically on
      `hasCoinFlipAbility`, NOT a general "any token-creating ability text
      is exempt" rule (that would wrongly also exempt real, resolvable
      token-creators like zanarkand/gysahl-greens from needing genuine
      scenario evidence — deliberately kept narrow).
    - `hasCostOnlyArtifactSacrifice`/`isCostOnlyArtifactSacrificeWant` for
      (4) — a card whose `activationCost` (checked both faces) matches
      "Sacrifice a/an/two artifact(s)" AND has no real `{kind:'sacrifice'}`
      effect gets the want for free, tautologically (same class as
      `isLandTapSelfWant`/`hasStaticLandTapSelfTrigger`). **Scope check
      done before writing**: `sidequest-catch-a-fish-cooking-campsite`'s
      own back face (Cooking Campsite) has the EXACT same cost-only-
      sacrifice-an-artifact shape (its own `knownGaps` already documents
      it unmodeled) — this new exemption would cover a matching want fact
      there too, but I did NOT touch that card (out of scope, not asked) —
      flagged in the-gold-saucer's own progress.json notes as a loose end
      worth revisiting if the user wants parity there.
  - Re-verified after all 3 facts: `the-gold-saucer` OK, full
    `verify-synergy.mjs` sweep unchanged (still 1 pre-existing unrelated
    hard failure), `npx vitest run functional-model` 181/181, full
    `npm run test` unchanged (same 5 pre-existing unrelated `tagging/*`
    failures).

- **2026-09-09: wrote real v2 `synergy.json` content for the 11 FIN Town-cycle
  lands whose synergy.json was still the empty `{"source":[],"sink":[]}` stub
  (baron-airship-kingdom, gohn-town-of-ruin, gongaga-reactor-town,
  guadosalam-farplane-gateway, insomnia-crown-city, rabanastre-royal-city,
  sharlayan-nation-of-scholars, windurst-federation-center, treno-dark-city,
  crossroads-village, the-gold-saucer) — an interrupted prior session had
  already written these 9 + crossroads-village's progress.json/scenarios.ts
  with a "verifySynergy: pass" story but never actually wrote the synergy.json
  itself. definition.ts was already correct for all 11, untouched.**
  - The 9 plain "enters tapped, {T}: Add X or Y" lands + crossroads-village:
    exact vector-imperial-capital template (played/battlefield-presence/
    enters-tapped/mana, all static exemptions in verify-synergy.mjs, no
    scenario needed). Cleared the 3 stale "no enters produce possible"
    knownGaps entries (sharlayan/windurst/treno) the same way
    vector-imperial-capital's own note already resolved it.
  - **crossroads-village's mana ability is "choose a color, {T}: Add one
    mana of the chosen color"** — no `any:true`-style field exists on
    `Constraints`/`TypeConstraint`; modeled it as `colors:{hasAny:['W','U',
    'B','R','G']}`, reusing the existing choice-of-color convention just
    widened to all five. To make this pass, **extended
    `verify-synergy.mjs`'s `staticManaColorsFor`** with a narrowly-scoped
    exemption recognizing the exact unique "{T}: Add one mana of the chosen
    color." text (checked: no other pool card uses this phrasing) as the
    same "known statically" shape the fixed single/choice-of-two case
    already gets — an engine-side script change, not just a synergy.json
    fact; flagged back to orchestrator as a judgment call since it's new
    exemption logic.
  - **the-gold-saucer** (enters untapped, unlike the other 10): wrote
    played/battlefield-presence + a real `event:drawCard` fact for the one
    modeled ability ("{3},{T},Sacrifice two artifacts: Draw a card").
    Deliberately did NOT write: (1) a mana fact for "{T}: Add {C}." — {C}
    is never recognized by `mana.ts`'s `manaAbilityColorsFromStaticText`
    (WUBRG-only, a documented gap) and no other static-mana-only land in
    the pool (capital-city/cavern-of-souls/starting-town/eclipsed-realms/
    clive-s-hideaway) has ever written this fact either; (2) a sink fact
    for "wants artifacts to sacrifice" — `engine.ts`'s own
    `unsupportedCostComponent` comment documents this exact cost as
    deliberately NOT modeled as a real `{kind:'sacrifice'}` effect (unlike
    ahriman/phantom-train/quina-qu-gourmet, which DO model theirs), so the
    scripted scenario never calls `actions.sacrifice` or any artifact
    zone/type read — no trace evidence could ever back this fact, and no
    static exemption covers it; (3) any fact for the coin-flip/Treasure
    ability, matching edgar-king-of-figaro's own "Two-Headed Coin" precedent
    (no fact at all for a probabilistic-only ability anywhere in the pool).
    All three flagged as judgment calls, not silently decided.
  - Verified: all 11 pass `npx vite-node functional-model/scripts/verify-synergy.mjs
    <slugs>`; full pool sweep (no args) still only has the ONE pre-existing
    unrelated hard failure (auron-s-inspiration, untouched by this pass).
    `npx vitest run functional-model` — 178/178 pass. Full `npm run test`
    has 5 unrelated pre-existing failures (missing `tagging/*` files, the
    separate historical-sets sweep project's data, confirmed pre-existing
    via `git stash`).
  - Open Forge-verification: none needed — all 11 cards' definition.ts was
    already Forge-cited and untouched; the only new engine-side logic
    (verify-synergy.mjs's crossroads-village exemption) is a reconciliation
    script change, not a rules-engine behavior change, so no Forge citation
    applies.

- **2026-09-09: audited every `functional-model/keywords/<bundle>/scenarios.ts`
  for synthetic filler cards (project rule: scenario board content must be
  real Scryfall data, not invented placeholders) — 5 of the 12
  `ai_reviewed` bundles had one, all fixed, all real cards drawn from FIN
  (data/fin/fin_scryfall.json), since `server/api/keywords/index.get.ts`'s
  `cardArtFor` only ever resolves art off that FIN-only pool — a real but
  non-FIN card name would still render as a placeholder chip, so FIN was a
  hard constraint here, not just a preference:
  - `flying-reach`: "Grounded Blocker" (2/2) → **Coeurl** (FIN, Creature —
    Cat Beast, 2/2, no Flying/Reach — its own tap-ability is inert here).
  - `vigilance-trample`: "Small Blocker" (1/1) → **Magitek Infantry** (FIN,
    Artifact Creature — Robot Soldier, 1/1, its own conditional +1/+0
    never fires, no other artifact on the board).
  - `deathtouch`: "Big Blocker" (4/4) → **Gigantoad** (FIN, Creature —
    Frog, printed base 4/4; its own 7-lands +2/+2 condition never fires).
  - `first-strike-double-strike`: "Would-Be Trader" (3/3) → **Shambling
    Cie'th** (FIN, Mutant Horror, 3/3); "Two-Toughness Blocker" (1/2) →
    **Stiltzkin, Moogle Merchant** (FIN, Legendary Creature — Moogle, 1/2,
    real Lifelink unused since filler cards never get a `keywords` array
    in these bundles — added `'Legendary'` to its `subtypes` per
    `state.ts`'s own legend-rule convention, same as every other Legendary
    FIN card already reused this way elsewhere in these bundles).
  - `menace`: "Blocker One"/"Blocker Two" (1/1 each) → **Hecteyes** +
    **Town Greeter** (both FIN, both keyword-free, ETB triggers inert
    since `addCard` never runs trigger detection).
  All 5 fixed bundles' P/T exactly match the original synthetic numbers
  (no scenario math changed), `registry.ts`'s own `cardNames` arrays got
  the new names appended (drives `KeywordEntryCard.vue`'s `namedCardArt`
  art lookup), and `run-keyword-scenarios.mjs` was rerun to regenerate all
  12 bundles' `trace.json` (only the 5 touched ones actually changed).
  Verified live via Playwright against the already-running dev server:
  all 5 pages (`/app/keywords/{flying-and-reach,vigilance-and-trample,
  menace,deathtouch,first-strike-and-double-strike}`) render real
  `<img>`s for every card on the board, zero placeholder chips remain.
  The other 7 `ai_reviewed` bundles (defender, flash, haste, indestructible,
  landfall, lifelink, saga) were audited too and are already clean — every
  `addCard` in those either reuses a real `cards/<slug>/definition.ts`
  import or (landfall) a real basic land ("Forest"). No entry in
  registry.ts uses `human_reviewed` status yet (confirmed via grep — the
  vocabulary is reserved but unused so far), so the "reset human_reviewed
  → ai_reviewed on content change" rule didn't actually apply to any of
  these 5; all 5 were already `ai_reviewed` and stayed that way, no status
  edit needed. `npm run typecheck` and the full `functional-model` +
  `app/lib/scenarioReplay.test.ts` suites pass (170 + 21 tests). No
  Forge-verification needed for this pass — pure filler-card substitution,
  no rules/engine-behavior change.

- **2026-09-09: mana producers are visible to synergy matching now.**
  `synergy.ts`'s `EventFact` gained a `color?: string` field (same
  "free-form, matched by plain equality when both sides declare it"
  treatment as `counterType`) — `factsInteract`/`themeOf` both wired for
  it. `scripts/prefill-mana-facts.mjs` (new) mechanically inserts/enriches
  an `{event:'addMana', controller:'you', color, value:1}` source fact for
  every real corpus card recognized by `mana.ts`'s own
  `manaAbilityColorFromStaticText` (a plain, unrestricted single-color
  `"{T}: Add {X}."` static-ability string) OR a structured
  `{kind:'addMana'}` Effect — same "bulk-add the zero-judgment stuff"
  precedent `prefill-main-types.mjs` set for theme tagging, just applied to
  synergy.json. Ran once already: touched cards/{druid-of-the-cowl,
  elvish-archdruid, goobbue-gardener, ishgard-the-holy-see-faith-grief,
  jidoor-aristocratic-capital-overture, lindblum-industrial-regency-mage-
  siege, llanowar-elves, midgar-city-of-mako-reactor-raid, sidequest-catch-
  a-fish-cooking-campsite, white-auracite, willowrush-verge, zanarkand-
  ancient-metropolis-lasting-fayth}/synergy.json — re-running the script is
  idempotent (safe to rerun after new cards are authored). Willowrush
  Verge's SECOND, restricted mana ability is still correctly unrecognized
  (mana.ts's own scope, not a bug).
  `scripts/compute-weights.mjs` got a matching `addMana` magnitude case
  (reads the real trace `amount`, same as putCounter/damage/lifegain) — do
  **not** run `compute-weights.mjs` bulk across the whole corpus casually
  again without diffing first: it silently overwrote ~9 unrelated cards'
  hand/AI-tuned `value` fields down to the neutral floor (1) this session
  (drawCard/grantKeyword/counter events have no magnitude case in the
  script — those values apparently came from a since-trimmed older version
  of the script, or were hand-set, and nobody's re-run the bulk script
  since). Those 9 were reverted via `git checkout` before finishing; if a
  future task needs a real bulk recompute, add the missing magnitude cases
  first or scope the run to touched slugs only.
  `scripts/verify-synergy.mjs` gained `staticManaColorsFor(card)` — a plain
  static-text mana Fact is verified statically off `definition.ts` (no
  trace/scenario evidence required), same "known statically" treatment
  `DEATH_TRIGGER_NAMES` already gets. This is the real mechanism behind
  "don't require scenario authoring for plain mana-tapping lands" — **not**
  `scripts/REVIEW_PROCESS.md`, which is the unrelated theme-tagging loop
  (`data/fin/fin_relations.json`), a separate dedicated-session process per
  SHARED.md's "known process boundaries." Flag this if a future ask
  conflates the two again.
- **2026-09-09: `describeFact`'s Battlefield-zone wording bug fixed.** A
  qualified (type/cmc-constrained) Battlefield fact used to render "X in
  your battlefield" — not real MTG terminology, battlefield is a shared
  zone (CR 400.2), no possessive form. Now renders "X you control on the
  battlefield" / "X an opponent controls on the battlefield" / "X on the
  battlefield" (controller omitted). Only the Battlefield branch changed;
  Hand/Graveyard/Library/Exile's own "in your/an opponent's <zone>" phrasing
  is untouched (those genuinely are per-player zones). Verified against
  fin/293 (Zanarkand, Ancient Metropolis // Lasting Fayth).
- **2026-09-09 (follow-up): acted on the "land-presence sink is graph
  noise" flag from earlier this session — removed pool-wide, verified per-
  card, not blanket-deleted by shape.** For all 17 Town-cycle cards sharing
  the ETB-tap-self trigger (`{kind:'tapTarget', validType:'land',
  owner:'you'}`), checked each one's OWN full effect set (front + any back
  face) individually before touching anything. 16 had the sink fact
  `{zone:'Battlefield', controller:'you', types:{has:['Land']}, value:1}`
  produced SOLELY by that trigger shape (no independent land-count want
  anywhere else in the card) — removed it from their `synergy.json`:
  baron-airship-kingdom, crossroads-village, gohn-town-of-ruin,
  gongaga-reactor-town, guadosalam-farplane-gateway, insomnia-crown-city,
  ishgard-the-holy-see-faith-grief, jidoor-aristocratic-capital-overture,
  lindblum-industrial-regency-mage-siege, midgar-city-of-mako-reactor-raid,
  rabanastre-royal-city, sharlayan-nation-of-scholars, treno-dark-city,
  vector-imperial-capital, windurst-federation-center,
  balamb-garden-seed-academy-balamb-garden-airborne (the 17th sibling's real
  slug — corrected from the notes-shorthand "balamb-garden-seed-academy"
  used in the original flag). For cards with a second sink (ishgard's
  Graveyard-artifact/enchantment, jidoor's opponent-Library, midgar's
  Creature/Artifact-battlefield), only the one matching Land-shaped entry
  was removed — the other sink(s) are real, untouched.
  **`zanarkand-ancient-metropolis-lasting-fayth` deliberately KEPT** — its
  back face ("Lasting Fayth") has a real, independent
  `actions.putCounter(created, '+1/+1', ctx.you.getLandsInPlay().length)`
  effect (counters on a token scaled by lands you control), a genuine
  "cares about land count" want unrelated to the front face's ETB-tap
  trigger — verified this is the ONLY one of the 17 with any such
  independent effect (checked every other sibling's full `definition.ts`,
  including all 4 other Adventure-Town backs — ishgard/jidoor/lindblum/
  midgar's back-face effects are graveyard-return/mill/token/sac+draw,
  none reference land count).
  None of the 16 touched cards' `progress.json` had `review`/
  `scenariosReview` at `"reviewed"`/`"human_reviewed"` (all already `"ai"`)
  — so the standing "reset reviewed→ai on content change" rule had nothing
  to actually flip this time; still added a dated `notes` entry + bumped
  `lastVerified` to today on all 16 for traceability (appended, did not
  overwrite pre-existing notes text on ishgard/jidoor/lindblum/midgar).
  Confirmed via `find-synergies.mjs` before/after that no land-related
  sink edge remains into any of the 16 (Midgar/Jidoor/Ishgard's OTHER real
  sink edges still correctly present), and that Zanarkand's land-battlefield-
  presence edges are unchanged/still present from every land-producing
  card in the pool. `verify-synergy.mjs` (same single pre-existing
  `auron-s-inspiration` hard failure, unchanged) and `vitest run
  functional-model` (170/170) both clean after. No `definition.ts`/
  `scenarios.ts`/`trace.json`/code changed — pure hand-authored
  `synergy.json` fact removal + `progress.json` notes, so no
  `run-scenarios.mjs` regeneration was needed. No new Forge citation
  needed (no rules-behavior change, purely a synergy-fact-authoring
  correction of an already-Forge-cited trigger shape).

- **2026-09-09: real bug found+fixed — Adventure spells were logged to
  Graveyard instead of Exile.** `harness.ts`'s `lifecycleAfter` only
  special-cased `alternateCosts.thenExile` (Flashback) for the
  Instant/Sorcery post-resolution zone; a real Adventure sorcery/instant
  cast normally (no alternate cost involved) was never recognized, so
  EVERY real Adventure card's own trace.json wrongly showed `to:
  "Graveyard"` (CR 715.3d actually redirects to Exile). Fixed generically
  via `/\bAdventure\b/.test(card.typeLine)` on the resolving face — not a
  per-card special case. This is what produced Zanarkand's own spurious
  `{zone:'Graveyard', subject:'self'}` source fact (an AI reading the
  buggy trace and taking it at face value) — removed after confirming
  `verify-synergy.mjs` now hard-FAILS that exact fact once the trace is
  corrected (proof the fact was never real). Re-ran `run-scenarios.mjs`
  corpus-wide; only the 6 real Adventure cards' trace.json actually changed
  (ishgard-the-holy-see-faith-grief, jidoor-aristocratic-capital-overture,
  lindblum-industrial-regency-mage-siege, midgar-city-of-mako-reactor-raid,
  thranduil-sindarin-liege-silvan-rally,
  zanarkand-ancient-metropolis-lasting-fayth) — all 6 progress.json's own
  notes updated to match. Checked jidoor/midgar's own separate Graveyard
  facts (mill, sacrifice) — legitimate, unrelated to this bug, left as-is.
  `adventurer-s-airship`/`adventurer-s-inn` are name-only false positives
  for "Adventure" (not the real subtype), not touched.

- **2026-09-09: broadened the mana-tapping-land scenario exemption to two
  more "common/simple land" shapes, same `verify-synergy.mjs` mechanism.**
  Per user's own stance ("for lands ... I don't think we need scenarios")
  — surveyed all 29 real FIN land `definition.ts` files first. Added
  `isStaticOnlyLand(card)` (a land with NO `effects`/`triggers`/
  `activationCost`/`modal` at all — every real ability is static text only
  — exempts its own baseline `{zone:'Battlefield', subject:'self'}`
  produce fact, since that's true by construction) and
  `hasStaticLandTapSelfTrigger`/`isLandTapSelfWant` (a land's `onEnter`
  trigger containing the real, identical-across-17-cards "enters tapped"
  replacement — `{kind:'tapTarget', validType:'land', owner:'you'}` —
  exempts the matching plain `{zone:'Battlefield', types:{has:['Land']}}`
  want, since `validType:'land'` IS "needs a land on the battlefield to
  tap," knowable straight off the Effect's own shape). Verified end-to-end
  with disposable `cards/_tmp-verify-test` fixtures (created + deleted,
  never left in the tree): both exemptions pass with a genuinely EMPTY
  `scenarios.ts`/`[]` trace.json; two negative controls (a land with a
  real, non-boilerplate effect; a non-land/non-`validType:'land'` tapper)
  still correctly hard-fail with no evidence — the exemption doesn't
  swallow anything actually unique. Full corpus re-verified afterward:
  still exactly 1 pre-existing hard failure (auron-s-inspiration, unrelated,
  documented below), 165/165 vitest.
  **Exempted (no scenario/trace needed for these facts)**:
  - Plain static mana-tap text (pre-existing, unchanged) — 10+ cards.
  - Static-only land baseline self-fact — 6 cards (cavern-of-souls,
    capital-city, clive-s-hideaway, starting-town, eclipsed-realms,
    willowrush-verge).
  - ETB-tap-self "enters tapped" Land-sink want — 17 cards (the whole
    Town-cycle: baron-airship-kingdom, crossroads-village,
    gohn-town-of-ruin, gongaga-reactor-town, guadosalam-farplane-gateway,
    insomnia-crown-city, ishgard-the-holy-see-faith-grief,
    jidoor-aristocratic-capital-overture,
    lindblum-industrial-regency-mage-siege,
    midgar-city-of-mako-reactor-raid, rabanastre-royal-city,
    sharlayan-nation-of-scholars, treno-dark-city, vector-imperial-capital,
    windurst-federation-center, zanarkand-ancient-metropolis-lasting-fayth,
    balamb-garden-seed-academy — front face only; back-face Vehicle stays
    scenario-required).
  **Deliberately LEFT scenario-required** (genuinely card-specific, only
  1 real FIN instance each, can't cross-check a "shape" against a single
  example the way the exemptions above do): breeding-pool's ETB pay-2-life
  shockland pattern (common in MTG generally, singleton in this pool);
  adventurer-s-inn's ETB gain-2-life; the-gold-saucer's sac-2-artifacts
  activated draw; elven-passage's self-sac + library search-to-battlefield;
  eden-seat-of-the-sanctum's mill+sac+return chain; sidequest-catch-a-fish's
  transforming Enchantment//Land; balamb-garden's transform+Vehicle back
  face; all 5 Adventure-Town lands' own back-face spell effects (only their
  shared front-face ETB-tap got exempted, not the Adventure side). Flagged
  for discussion, not silently locked in — if any of the "leave
  scenario-required" singletons later gets siblings in a future set, worth
  revisiting the same way.
  Also relayed a coordinator course-correction mid-task: this change is
  scoped PURELY to `verify-synergy.mjs`'s coverage requirement — did not
  touch any card's `progress.json` review/confirmation flags, and did not
  build any "empty scenarios.ts implies reviewed" logic anywhere. Whether/
  when to actually empty out any of these cards' own `scenarios.ts` is a
  separate authoring decision, out of scope here.
- **2026-09-09 (same day, follow-up): actually emptied `scenarios.ts` for
  the exempted cards** — the coordinator confirmed live in the Facts/UI
  (fin/291, vector-imperial-capital) that being merely "not REQUIRED" by
  verify-synergy still left the old boilerplate scenario sitting in the
  file, visible in the UI. 17 of the 23 exempted cards had NO other facts
  needing scenario evidence at all, so their `scenarios.ts` went straight
  to `export const scenarios: Scenario[] = [];` (the 11 plain Town-cycle
  ETB-tap lands + the 6 static-only lands). The other 6 (ishgard, jidoor,
  lindblum, midgar, zanarkand, balamb-garden — all Adventure-Town/transform
  cards) still have REAL, non-exempted facts from their own back
  face/transform (mill, sacrifice+draw, token creation, legend rule, ...)
  that genuinely still need scenario evidence — for these, only removed
  the now-redundant FIRST entry (`{result:'enters tapped', trigger:
  'onEnter'}`), left every other scenario in the array untouched. Did NOT
  blindly empty all 23 to `[]` — would have silently dropped real evidence
  for those 6 cards' still-unique facts and produced real hard failures,
  not just a scenario-authoring cleanup. Re-ran `run-scenarios.mjs`
  (regenerated all 23 `trace.json`), full-corpus `verify-synergy.mjs` (same
  single pre-existing `auron-s-inspiration` hard failure, unchanged), and
  `vitest run functional-model` (165/165) — all clean. No `progress.json`
  touched by this follow-up (confirmed via `git diff` — the `progress.json`
  changes visible in `git status` for willowrush-verge/ishgard/jidoor/
  lindblum/midgar/zanarkand all predate this session, from the earlier
  mana-color/Adventure-Graveyard-bug work already in notes.md above, not
  from this edit).

- **2026-09-09: `functional-model/keywords/registry.ts` expanded from a
  15-entry FIN-only subset to the full historical MTG keyword taxonomy
  (369 entries).** Source: Scryfall's live public catalog endpoints
  (`/catalog/keyword-abilities` 223, `/catalog/keyword-actions` 79,
  `/catalog/ability-words` 69 — fetched 2026-09-09, same source WotC's own
  CR glossary is built from, more current than any static list). Shape
  changes (all 3 confirmed against `card`'s parallel work, which had
  already built a `reviewStatus`/`ReviewStatus` bridge in
  `server/api/keywords/{index.get,review-status}.ts` anticipating exactly
  this): `KeywordStatus` is now `'not_implemented' | 'ai_reviewed' |
  'human_reviewed'` (was `'covered'|'gap'`; existing `covered`→`ai_reviewed`,
  `gap`→`not_implemented`, nothing newly reviewed); `category`'s
  `'fin-mechanic'` value renamed `'set-specific'` (field name/grouping
  semantics unchanged); new `setsUsed?: string[]` (lowercase Scryfall set
  codes) on every `'set-specific'` entry, sourced from `data/cards.db`
  (local full per-printing Scryfall mirror, 1993-2027, NOT the oracle-cards
  bulk file) — excludes `set_type: promo|token` printings, keeps everything
  else (Commander/Duel-deck/Un-set included) — see registry.ts's own header
  for the full caveat writeup. `card.ts`'s `Keyword` union got exactly 2
  new members fixing a REAL pre-existing inconsistency (`Protection`,
  `Saga` — both already referenced by registry.ts's `keywords` field before
  this pass despite not being union members; `Convoke` was NOT actually
  missing, contrary to the initial task brief — already present) —
  deliberately did NOT bulk-extend the union with the other 354 new
  taxonomy terms (kept scoped to "an identifier some real
  CardDefinition/effect actually uses," registry's own `keywords` field
  stays plain `string[]`, no compile-time coupling). Of the 354 new
  entries, 27 are FIN-relevant (appear on a real FIN card) and got an
  individually hand-checked `gapNote` against current engine.ts/card.ts/
  state.ts/tokens.ts/ENGINE_DESIGN.md (several — Equip, Crew, Fight,
  Surveil, Mill — are actually already well-supported in the engine, just
  missing a keywords/ bundle for THIS page; gapNote says so explicitly
  rather than implying a false engine gap). Per explicit orchestrator
  mid-task correction: NO new engine implementation or
  functional-model/keywords/<bundle> scenarios were built for this pass —
  every non-FIN keyword, and every FIN keyword lacking a pre-existing
  bundle, is `not_implemented` by design regardless of how buildable a
  gapNote's own research made it look; the pre-existing 12 `ai_reviewed`
  bundles are the only ones. Also completed the handoff `card` had left
  TODO-flagged: collapsed `index.get.ts`'s two-field `status`/`reviewStatus`
  split back into one `status` field now that registry.ts's own status IS
  the shared 3-way vocabulary, and fixed `review-status.ts`'s stale
  `'gap'` check to `'not_implemented'`. Also mechanically updated
  `app/pages/app/keywords/index.vue`/`app/components/KeywordEntryCard.vue`'s
  literal `'covered'`/`'gap'`/`'fin-mechanic'` comparisons just enough to
  typecheck (binary-styled badge, `!== 'not_implemented'` treated as
  covered) — explicitly flagged in both files' own comments as a stopgap;
  a real 3-way visual treatment (ai_reviewed vs. human_reviewed,
  `setsUsed` display, and the 356-item `set-specific` sidebar list's own
  scale/searchability) is real follow-up work for `ui`, not attempted here.
  `npm run typecheck` (whole repo) and `vitest run functional-model`
  (165/165) both verified passing after all changes.

- **2026-09-09 (same day, follow-up): prototyped two new source-fact shapes
  on ONE card only** (`cards/vector-imperial-capital`, fin/291) — a trial
  for the coordinator to look at before deciding on a corpus-wide rollout.
  Explicitly did NOT run either fix corpus-wide; only this one card's
  `synergy.json` changed data-wise.
  1. **"Enters tapped" split off the generic bare `entersBattlefield`
     event.** Added `EventFact.tapped?: boolean` (same documented
     free-form-field/plain-equality-when-both-sides-declare-it treatment as
     `counterType`/`color`), wired into `themeOf` and `factsInteract`'s
     equality check the same way those two already are, and extended
     `describeFact`'s `entersBattlefield` branch: `'enters the battlefield
     tapped'` when set, unchanged bare `'enters the battlefield'`
     otherwise. Added the actual fact to vector-imperial-capital only:
     `{id:'enters-tapped', event:'entersBattlefield', controller:'you',
     subject:'self', tapped:true, sourceText:'Vector, Imperial Capital
     enters tapped.', highlight:'enters tapped', value:1}`. Also added
     `isLandEntersTappedSelfFact` to `verify-synergy.mjs` (the SOURCE-side
     counterpart to the pre-existing `hasStaticLandTapSelfTrigger` sink
     exemption) so this fact needs no scenario/trace evidence — same
     "known statically off definition.ts" reasoning as everything else in
     that file. This new exemption function is structurally generic (would
     recognize the identical fact shape on any of the other 16 Town-cycle
     lands sharing this same trigger shape) but is CURRENTLY INERT for all
     of them since none of their `synergy.json` files declare the fact yet
     — nothing was regenerated/touched for those 16.
     **`subject: 'self'` judgment call, explicitly made, not defaulted
     into**: the modeled trigger itself is `{kind:'tapTarget',
     validType:'land', owner:'you'}` — literally "tap A land you control,"
     not "tap this specific permanent" — already flagged in this exact
     card's own file header (and treno-dark-city's, the canonical
     citation) as a deliberate approximation that "finds exactly self as
     long as no OTHER land is set up for 'you' in a given scenario."
     Despite that, `subject: 'self'` is the ACCURATE fact here: the real
     oracle text ("Vector, Imperial Capital enters tapped") is genuinely a
     self-only replacement effect (CR 614-shaped), and the trigger's
     pool-based tap is a known, already-documented MECHANICAL shortcut for
     implementing that — not evidence the ability itself is "tap any
     land." Caveat worth flagging forward, not new: if a FUTURE scenario
     ever puts a second land into play for 'you' before this trigger fires
     (none currently exist for any of the 17 Town-cycle cards —
     `scenarios.ts` is empty for all of them per the earlier "actually
     emptied scenarios.ts" pass), the modeled EFFECT could tap the wrong
     land even though the FACT itself would still correctly describe the
     real card. Not a new problem introduced here, just now has a fact
     riding on top of it worth remembering.
  2. **The missing two-color mana fact.** Confirmed why
     `prefill-mana-facts.mjs`/`mana.ts`'s own `manaAbilityColorFromStaticText`
     never picked up Vector's own `"{T}: Add {B} or {R}."` — that function
     only ever recognized a single plain color symbol (`^\{T\}: Add
     \{([WUBRG])\}\.$`), an "X or Y" choice fails the regex outright and
     falls through to `undefined`. Added a new, separate export,
     `manaAbilityColorsFromStaticText` (plural) — recognizes BOTH the
     existing single-color shape and a new `^\{T\}: Add \{X\} or
     \{Y\}\.$` shape, returning an array of every color the FIRST matching
     ability names. Deliberately kept SEPARATE from the existing
     `manaAbilityColorFromStaticText`/`manaColorOf`/`RealCard.manaAbility`
     path used for real engine-play affordability (`engine.ts`) — that
     path stays single-color-only, unchanged; the new function is
     explicitly documented as fact-generation-only, since correctly
     affording a real choice-of-color source at cast time needs a genuine
     bipartite-matching assignment (ENGINE_GAPS.md gap #5's own documented
     remainder), not attempted here.
     **Fact shape decided: two separate `addMana` facts, one per color**
     (`mana-b`/`mana-r`, each `value:1`, same `sourceText`, per-color
     `highlight`) — not one fact with an array-valued `color`. This was
     forced, not arbitrary: `EventFact.color` is already documented as
     "matched by plain equality when both sides declare it," the same
     contract `counterType` already relies on; an array would silently
     break that equality contract for every existing single-color
     `addMana` fact in the corpus. Two facts also correctly lets a future
     "wants a red mana source" sink match on just the R half without
     implying the land produces BOTH colors simultaneously (it produces
     one OR the other per activation, same as the real card).
     `prefill-mana-facts.mjs` updated generically (now emits one entry per
     recognized color off the plural function; `verify-synergy.mjs`'s
     `staticManaColorsFor` updated the same way, unioning both faces' own
     recognized colors) — this is a real, generically-correct fix
     affecting all 12 real FIN cards with this exact "Add X or Y" land
     shape (grepped: balamb-garden-seed-academy, baron-airship-kingdom,
     breeding-pool, gohn-town-of-ruin, gongaga-reactor-town,
     guadosalam-farplane-gateway, insomnia-crown-city, rabanastre-royal-
     city, sharlayan-nation-of-scholars, treno-dark-city,
     vector-imperial-capital, windurst-federation-center — NONE had a
     hand-authored `addMana` fact before this pass, confirmed by grep), but
     per explicit scoping instruction only ACTUALLY RUN for
     vector-imperial-capital: `prefill-mana-facts.mjs` gained a new
     `--slug=<slug>` CLI filter (alongside the pre-existing `--dry`)
     specifically so a single-card trial run doesn't require a temporary
     script fork — used it here, verified via `--dry` first that only
     vector-imperial-capital's own file would be touched, then ran for
     real. The other 11 real cards' own `synergy.json` are completely
     untouched by this pass; running the (now dual-color-aware) script
     bare (no `--slug`) would pick all of them up whenever the corpus-wide
     rollout is actually approved.
  Verification: `verify-synergy.mjs vector-imperial-capital` (OK),
  `verify-synergy.mjs` full corpus (same single pre-existing
  `auron-s-inspiration` hard failure, unchanged — 312 checked/8
  skipped/1 hard failure, identical counts to before this pass),
  `vitest run functional-model` (165/165), `tsc --noEmit` (no
  functional-model errors). Confirmed live via `curl
  localhost:3000/api/card/fin/291` that the served `functionalModel.synergy`
  matches the file exactly (server passes it through untouched, per
  contract), and via a standalone `describeFact` invocation against the
  card's own `synergy.json` that the rendering is exactly `'enters the
  battlefield tapped'` / `'your mana production'` (×2, one per color) /
  the unchanged sink description. Did NOT independently confirm the
  rendered DOM in an actual browser — no browser/screenshot tool available
  in this session; the dev-server API-level check is the closest
  substitute available here. `(・_・?)` if the coordinator wants an actual
  visual check before signing off, that still needs a human or a
  browser-capable tool, not this session.
  Also, same "no per-color grouped rendering" flag as the original
  `color` field note above applies to `tapped` too — `describeFact` only
  renders the terse "enters the battlefield tapped," no richer templating;
  that's `card`'s own follow-up territory per the contract, not extended
  here.

- **2026-09-09 (follow-up): "played" is now a real, structurally-grounded
  Fact-vocab event, distinct from `entersBattlefield` — CR 305's land-drop
  special action.** Surveyed first: before this pass, NEITHER
  `harness.ts` NOR `engine.ts` distinguished "a land was played" from "a
  permanent was cast" at all — `harness.ts`'s own `lifecycleBefore`
  unconditionally emitted `fn:'cast'` for a Land typeLine same as any
  other permanent, and `engine.ts`'s `castSpell` has no land branch
  whatsoever (a real, separate, bigger gap — logged as ENGINE_GAPS.md's
  new gap #12, not attempted here since no FIN land uses
  `runEngineScenarios` today). Fixed the harness/trace-generation half,
  which is what actually produces every FIN land's own `trace.json`:
  `lifecycleBefore` now emits a real, distinct `fn: 'playLand'` (not
  `cast`) for a Land typeLine going through the ordinary
  (non-trigger/non-ability/non-activation) scenario path — `describeAction`
  updated to match ("played as a land (CR 305 special action)" instead of
  "cast from hand"). `synergy.ts`'s `EventFact` gained a new documented
  vocabulary value, `event: 'playLand'` (no new field — `event` is a plain
  string, same as `castCreatureSpell`/`activateAbility`'s own verb+noun
  naming convention), with a doc comment explicitly warning `playLand` and
  `entersBattlefield` are NEVER derivable from each other (a land can enter
  without being played — Elven Passage's own library-fetch — or be played
  and then also enter; author both facts independently, never assume one
  implies the other). `describeFact` renders it as "being played as a
  land". `scripts/verify-synergy.mjs` gained a matching `producedEvent`
  case for `fn:'playLand'` (added to `explainableFns` too) — critically,
  this fact got **NO static "known from definition.ts alone" exemption**
  (unlike `isStaticOnlyLand`/`isLandEntersTappedSelfFact`/
  `staticManaColorsFor`, all in the same file): those exemptions are safe
  because the fact they cover is true regardless of HOW the permanent
  reached the battlefield; `played` is specifically about the mechanism
  itself, which is exactly the thing that risks being silently wrong (a
  fetch/ramp effect putting a land onto the battlefield directly must NOT
  get credited with a `played` fact) — so it deliberately keeps demanding
  real scenario/trace evidence, the opposite call from the mana/enters-
  tapped exemptions, made and justified explicitly, not defaulted into.
  `scripts/run-scenarios.mjs` gained a `--slug=<slug>` filter (same
  convention `prefill-mana-facts.mjs` already established) so a single-card
  trial regenerates only that card's own `trace.json`.
  **Prototyped on `vector-imperial-capital` only** (fin/291): added a real
  (non-empty) `scenarios.ts` — one plain default scenario — whose
  regenerated `trace.json` now shows a genuine `{fn:'playLand', ...}` line
  distinct from the following `{fn:'enters', zone:'Battlefield'}`. Added
  matching `synergy.json` source facts: `played` (`event:'playLand'`,
  `subject:'self'`) and, to clear a soft note the new real trace surfaced
  (this card never had ANY trace evidence before, so its baseline
  "permanent on your battlefield" fact was simply never authored),
  `battlefield-presence` (`zone:'Battlefield', subject:'self'`, matching
  the same baseline convention `cavern-of-souls`/`starting-town` already
  use). Full fact set after this change (source): `played` → "being played
  as a land", `battlefield-presence` → "battlefield presence",
  `enters-tapped` → "enters the battlefield tapped", `mana-b`/`mana-r` →
  "your mana production" (×2). Verified `elven-passage`'s own
  `synergy.json`/`trace.json` are completely untouched and correctly
  produce NO `playLand` fact for its fetched land (its own `custom` effect
  calls `actions.moveTo` directly — never reaches `lifecycleBefore`'s Land
  branch at all, since that fetched land is a different `RealCard`, not
  the scenario's own `self`; elven-passage's OWN card also never reaches
  the new branch either, since it has `activationCost` set, which is
  checked first).
  Verification: `verify-synergy.mjs vector-imperial-capital elven-passage`
  (both OK/clean — vector-imperial-capital fully clean, elven-passage's
  2 `loseLife`-soft-notes confirmed pre-existing via `git stash` A/B, not
  from this change), full-corpus `verify-synergy.mjs` (same single
  pre-existing `auron-s-inspiration` hard failure, 312 checked/8 skipped/1
  hard failure — identical counts to before this pass), `vitest run
  functional-model` (165/165), `tsc --noEmit` (no functional-model
  errors), and a standalone `describeFact` check confirming all 5 of
  vector-imperial-capital's own source facts render correctly.
  **Deliberately did NOT run `run-scenarios.mjs` bulk** (no `--slug`) —
  would have touched every OTHER real land's own checked-in `trace.json`
  too (their `fn:'cast'` bracket is now stale relative to the new
  harness.ts code — still harmless today since `IGNORED_FNS` treats `cast`
  the same as before and nothing currently declares/needs a `playLand`
  fact for any of them), per explicit task scoping to prototype on one
  card. Also found the repo's working tree already had a large amount of
  OTHER uncommitted work in progress (keywords registry rewrite, mana-color
  prototype, Adventure-Graveyard bugfix, etc. — all previously documented
  above in this same notes file) sitting in the tree from earlier
  session(s) — confirmed via `git stash`/`git stash pop` that my own edits
  round-tripped cleanly and I did not disturb any of it; left entirely
  alone, not part of this task.

## Open questions / still open

- **This session's own trial, awaiting the coordinator's rollout
  decision**: whether to (a) run `prefill-mana-facts.mjs` bare (no
  `--slug`) to pick up the other 11 real "Add X or Y" Town-cycle lands,
  and (b) hand-author the equivalent `{event:'entersBattlefield',
  subject:'self', tapped:true, ...}` fact on the other 16 real Town-cycle
  lands sharing the exact same trigger shape (`isLandEntersTappedSelfFact`
  in verify-synergy.mjs already recognizes the shape generically the
  moment any of them gets the fact — no further code change needed to
  extend, just the data). Not done pending that decision, per explicit
  task scoping.
- **Same open rollout question, now also for `played`/`playLand`**: the
  code (harness.ts's `playLand` branch, synergy.ts's vocab, verify-
  synergy.mjs's `producedEvent` case) is already generic — the moment any
  other real land gets a genuine (non-empty) `scenarios.ts` with a plain
  default entry, its own regenerated `trace.json` will show the same real
  `playLand` evidence, and its own `synergy.json` can then honestly declare
  the fact. NOT rolled out corpus-wide here (prototyped on
  vector-imperial-capital only, per explicit task scoping) — a future pass
  would need to (re-)populate a plain default scenario for every OTHER
  real land whose `scenarios.ts` was emptied to `[]` in the earlier
  "actually emptied scenarios.ts" pass (the 6 static-only lands + the 17
  Town-cycle ETB-tap lands), since `played` deliberately has no static
  exemption the way those cards' other facts do — this is real added
  authoring work per land, not a one-line script run, unlike the mana-
  color/enters-tapped rollouts.
- **Real Forge-verification still needed, not done this pass**: I did not
  independently re-verify CR 305.1's exact wording/section number against
  a live rules text or Forge's own `PlayerZoneBattlefield`/land-drop
  handling code — this pass reasoned from the CR number already used
  elsewhere in this codebase's own comments (E.g. Equip's 301.5c citation
  style) and well-established general MTG rules knowledge, not a fresh
  `../tmp/mtg-forge` citation. If a future pass builds the real `engine.ts`
  CR 305 special-action mechanics (ENGINE_GAPS.md's new gap #12), it
  should cite the real Forge land-play source file/line the way every
  other `interfaces.ts`/engine mirror entry does, same as this project's
  own ground-truth discipline requires — flagging this rather than
  silently treating my citation as Forge-verified.

- **Follow-up for `ui`, not started here**: the "Keywords" page's sidebar
  now has 356 `set-specific` entries (up from 2) with no search/filter/
  virtualization — a flat scrollable list works but will be unwieldy;
  real UI work, out of this pass's scope. Also the section label text
  "FIN-set mechanics" (index.vue) is now inaccurate now that the bucket
  covers the full taxonomy — cosmetic rename, not required for typecheck,
  left for `ui`.
- **`ruleCite` precision for the 354 newly-added entries is intentionally
  generic** ("CR 702 (keyword ability)" / "CR 701 (keyword action)" /
  "CR 207.2c (ability word)") rather than a specific numbered CR
  subsection — verifying 354 individual subsection numbers against a
  specific current rules build was out of scope for this pass; a future
  pass could tighten high-traffic ones (Ninjutsu, Cycling, Kicker, etc.)
  the same way the pre-existing hand-authored entries already are.
- **`setsUsed` for a handful of catalog terms is an empty array** — mostly
  generic keyword ACTIONS (Tap, Untap, Destroy, Cast, ...) that Scryfall's
  own per-card `keywords` tagging apparently never actually applies to any
  single printing (confirmed: 24 of 371 catalog terms have zero
  `data/cards.db` hits) — not a bug in the extraction, just how Scryfall's
  own tagging works for pure generic verbs.



- No new Forge citation needed for this pass — the 17 exempted lands'
  "enters tapped" replacement was already individually Forge-cited in each
  card's own `definition.ts` comment before this change; this pass only
  changed what evidence `verify-synergy.mjs` demands, not any rules
  behavior. Flag for later: if a FUTURE land's `onEnter` trigger LOOKS like
  this same `tapTarget`/`validType:'land'`/`owner:'you'` shape but its real
  Forge script actually does something subtly different (e.g. taps a
  player-chosen OTHER land, not just self), `hasStaticLandTapSelfTrigger`
  would wrongly treat it as the boilerplate case — worth re-checking the
  real script text against this exact structural match before trusting it
  for a new card, not just pattern-matching the TypeScript shape.

- **Pre-existing, confirmed unrelated to this session's changes**:
  `auron-s-inspiration` hard-fails `verify-synergy.mjs`
  (`produce {zone:Exile,controller:you} has no supporting trace line`) —
  verified via `git stash` that this fails identically without any of this
  session's edits. Not investigated further (out of this task's scope);
  flagging for whoever picks up general verify-synergy hygiene next.
  `midgar-city-of-mako-reactor-raid`'s `progress.json` also records
  `verifySynergy: "pass"` despite 2 real pre-existing soft notes (`drawCard`
  unrecognized) — flagged in its own notes field, not fixed (predates this
  session, unrelated to the addMana/Adventure work).
- **Not done, flagged as a real follow-up for the `card` agent**: the new
  `EventFact.color` field is intentionally NOT rendered by `describeFact`
  beyond the terse "your mana production" (no per-color text, no grouped/
  summarized "Source: Mana (G)" display) — per `.claude/contracts/card-
  schema.md`'s existing note that `describeFact`/`constraintBits` shouldn't
  gain more templating/grouping logic, that richer rendering is `card`'s
  own follow-up work once it reads `fact.color` directly.
- Full FIN corpus re-verified (`verify-synergy.mjs`, `find-synergies.mjs`,
  `compute-weights.mjs` narrowly for the addMana case, `vitest run
  functional-model` — 165/165 pass) after all changes above; `npm run test`
  (whole repo) also run — only unrelated pre-existing failures
  (`scripts/relations.test.mjs`, missing `tagging/` files, a different
  domain/process entirely).

- **2026-09-09 (later same day) — follow-up pass, 4 items:**
  1. **ENGINE_GAPS.md gap #12 reframed** (was: "no land branch in
     `castSpell`/`pilotCast`" — same conceptual mistake `harness.ts`'s
     fix corrected in wording, not code). Corrected to: the real gap is
     `engine.ts`/`engine-trace.ts` having **no `playLand` action at all**
     in the real pilot path (a land is never cast, full stop) — separately,
     flagged that `castSpell`/`canCastSpell`/`pilotCast` WOULD actively
     mistreat a land as a spell if ever called with one (no typeLine
     guard exists) — a real **dormant/live-the-moment-triggered bug**, not
     just an absent feature, but currently unreachable since no FIN land's
     `scenarios.ts` uses `runEngineScenarios()` today (checked). Whoever
     builds the real `playLand` pilot action should add the typeLine guard
     to `castSpell`/`canCastSpell` in the same pass.
  2. **New `EventFact.colors: TypeConstraint` field** (synergy.ts) — reuses
     `TypeConstraint`'s exact `has`/`hasAny`/`not` vocabulary AND its
     existing `satisfiesType` matcher (no new matching code), via a new
     `colorSetOf(fact)` helper that flattens a produce's own `colors`
     (or legacy singular `color`, wrapped as a one-element set) into the
     real enumerable color list `satisfiesType` checks a want's `colors`
     (or legacy `color`) against. `factsInteract`'s old
     `pe.color !== we.color` plain-equality line is now this unified
     check — fully backward compatible (verified: a legacy `color`-only
     produce still matches a new `colors`-shaped want and vice versa, see
     `synergy.test.ts`). `describeFact`'s `addMana` case now renders a
     `colors`-shaped fact's label using the SAME has-joined-by-space /
     hasAny-joined-by-slash wording `constraintBits` already uses for type
     wants ("your mana production (B/R)") — deliberately does NOT render
     the legacy singular `color` field the same way (kept the prior
     terser wording for the other 11 cards, since a past explicit call
     said not to add more `color` rendering — only the NEW field changes
     the label).
  3. **`vector-imperial-capital`'s `mana-b`/`mana-r` migrated to ONE
     `mana-b-r` fact** (`colors: {hasAny:['B','R']}`) in its `synergy.json`.
     **The other 11 real single-color `addMana` cards (Druid of the Cowl,
     Goobbue Gardener, Llanowar Elves, Midgar, Ishgard, Jidoor, Lindblum,
     Zanarkand, White Auracite, Willowrush Verge, Elvish Archdruid) are
     NOT migrated** — still using the legacy singular `color` field, which
     still matches correctly (backward-compat, see above) but is now the
     "old" shape; a real follow-up would migrate them to `colors:{has:[X]}}`
     for consistency, not required for anything to keep working.
  4. **`prefill-mana-facts.mjs` rewritten** to emit ONE `colors:{hasAny:
     [...]}` fact for a real choice-of-color ability (was: two separate
     `color:'B'`/`color:'R'` facts) — single-color abilities unchanged
     (still legacy `color:string`). Idempotency check updated to match
     on either shape. Dry-run against the full pool confirms
     `vector-imperial-capital` is now correctly skipped (already has the
     matching combined fact) and would newly write 11 OTHER real
     Town-cycle choice-of-color lands (treno-dark-city, baron-airship-
     kingdom, breeding-pool, etc.) if run for real — **not run for real,
     scope stayed to vector-imperial-capital only**, per explicit task
     scoping.
  5. **New `functional-model/synergy.test.ts`** (this codebase's first
     `synergy.ts` unit test file) — 5 tests proving `colors` matching
     end-to-end via the real `findInteractionsForCard` entry point (not a
     private-helper unit test): `hasAny` produce vs. `has` want (match),
     non-overlapping color (no match), `hasAny` want overlap (match),
     `not` want excluding a produced color (no match), and legacy
     `color`-produce vs. new `colors`-want backward compat (match).
  6. **Course-corrected on the `played`/`playLand` scenario-exemption
     call from earlier this session**: reverted `vector-imperial-capital`'s
     `scenarios.ts` back to empty `[]` (was a real default scenario added
     to force genuine trace evidence for the `playLand` fact) — the
     correct read (per coordinator relay) is that a Land's own SELF-play
     fact is exactly as tautologically true-by-construction as its
     other facts already got exempted for; the real risk `playLand`'s
     evidence requirement guards against (a DIFFERENT card fetching a land
     other than itself, elven-passage-style) doesn't apply to a land's own
     fact about itself. Added `isSelfPlayableLand` (verify-synergy.mjs) —
     statically exempts a Land's own `{event:'playLand', subject:'self'}`
     fact. This exposed a SECOND, previously-untouched fact that also lost
     its only evidence once the scenario went away: `battlefield-presence`
     (`{zone:'Battlefield', subject:'self'}`) — `isStaticOnlyLand` doesn't
     cover it (requires NO triggers/effects at all; Vector has an onEnter
     tap trigger), so I added a new, narrower
     `isSelfBattlefieldPresenceLand` (same file) — same reasoning again:
     a Land's own bare unconstrained battlefield-presence is tautological
     regardless of what OTHER abilities it has, since resolving a land
     always puts IT on the battlefield no matter what its triggers/mana
     abilities do. Regenerated `trace.json` back to `[]` via
     `run-scenarios.mjs --slug=vector-imperial-capital`. `verify-synergy.mjs`
     OK for this card afterward, full-pool sweep unchanged (still only the
     one pre-existing unrelated `auron-s-inspiration` failure).
  7. **Fixed a real review-flag regression**: `progress.json`'s
     `scenariosReview` had been left at `"reviewed"` after a prior turn's
     edit to `scenarios.ts` changed what it was reviewing — reset to
     `"ai"` per the user's explicit instruction ("Any changes - status back
     to AI", applies going forward to every future task touching
     `scenarios.ts`/`synergy.json`/`definition.ts`, not just this one).
     **Flagged, not built**: a generic automated safeguard (a
     `verify-synergy.mjs`-style check, or a content-hash comparison
     against what `scenariosReview: reviewed` last saw) would catch this
     class of regression corpus-wide instead of relying on each agent
     turn remembering to reset it by hand — worth having someone actually
     build, not attempted here per explicit "don't build unprompted."
  8. **`describeFact`'s `playLand` wording changed to the user's exact
     ask**: `'Play a land.'` (was `'being played as a land'` from earlier
     this session). Investigated the "why is the live page showing raw
     `playLand`" report: confirmed directly (`describeFact` called with a
     `playLand` fact) that the function itself now returns the right
     string, and found no OTHER place a card-page/graph render path
     bypasses `describeFact` for this fact (`server/api/graph-links.ts`
     also routes through the same live `findInteractionsForCard` call, no
     caching layer in dev). The ONE place a raw `fn` string genuinely
     still renders verbatim is `app/components/ScenarioReplayTrace.vue`'s
     own "fn" debug column (`row.entry.fn`, line ~553) — that's a
     deliberate raw/technical trace-log view (every fn renders unrendered
     there, not just `playLand`), not a `describeFact` bypass bug; flagged
     for `card`/`ui` in case the user actually meant that column, but
     didn't touch it (out of engine's lane, and it's arguably correct as
     designed). Best guess for what the user actually saw: a stale
     page/HMR state from before the wording landed, or genuinely looking
     at that raw fn column — couldn't reproduce a live bug in the code as
     of this pass.
  9. **Land-presence sink fact — flagged this pass, ACTED ON in a later
     same-day follow-up** (see the dated entry higher up this file, "acted
     on the 'land-presence sink is graph noise' flag" — removed pool-wide
     from 16 of the 17 Town-cycle siblings, kept on
     zanarkand-ancient-metropolis-lasting-fayth since it has a genuine
     independent land-count want). Original reasoning preserved here:
     the fact originates from the `tapTarget{validType:'land', owner:'you'}`
     effect's own candidate-pool requirement, which is ALWAYS trivially
     self-satisfied (the card itself is a land, already on the battlefield,
     the instant the trigger fires — harness.ts's own selfZone rule) — the
     [continued below — see the rest of that note further down this file]

- **2026-09-09 (later same day again) — ENGINE_GAPS.md gap #12 actually
  CLOSED this pass: a real `playLand`/`canPlayLand` action now exists in
  `engine.ts`'s real pilot path, not just harness.ts's trace-label fix.**
  Got a real Forge checkout this time (network was available; sparse-cloned
  `Player.java`/`PlayerController.java`/`GameAction.java`/`PhaseHandler.java`
  into `/home/sva/Projects/mtg-forge` — matches the `../mtg-forge`-relative-
  to-this-repo path every other citation in this codebase already assumes;
  left the checkout in place afterward per that same standing convention,
  not scratchpad-cleaned). Real Forge reference, cited directly (not
  reasoned from CR text alone, unlike the earlier same-day pass that
  flagged this as owed): `Player.playLand` (`Player.java` ~1624-1651) does
  a direct `game.getAction().moveTo(Battlefield, land, cause)` — no Stack
  trip at all — then fires `TriggerType.LandPlayed`, then
  `addLandPlayedThisTurn()`. `Player.canPlayLand` (~1653-1688) gates on
  305.3's own timing via `canCastSorcery()` (~2508-2511: own turn + main
  phase + empty stack — the EXACT SAME rule this engine's own
  `sorcerySpeedTimingOk` already implements for sorcery-speed spells, so
  reused directly rather than re-derived) plus
  `getLandsPlayedThisTurn() < getMaxLandPlays()` (default max 1,
  `Player.java` ~1690-1696). Reset: `Player.onCleanupPhase()`
  (~2456-2473) calls `resetLandsPlayedThisTurn()` unconditionally each
  cleanup — this engine's own `turn.ts` mirrors that for the ACTIVE
  player only (same established "only the active player's own Cleanup
  actions are modeled" scope 514.1's discard already uses; a non-active
  player's count can never be nonzero here anyway, since only the active
  player passes `sorcerySpeedTimingOk`'s own-turn check).

  **What got built** (all in this one pass):
  - `state.ts`: new `RealPlayer.landsPlayedThisTurn?: number`.
  - `turn.ts`: Cleanup's `runPhaseEntryAction` now resets it for the active
    player, right alongside 514.1/514.2.
  - `engine.ts`: new `canPlayLand`/`playLand` pair, same `ActionResult`/
    "check separately from the mutating action" shape `canCastSpell`/
    `castSpell` already use. `playLand` is ONE call (not a cast+resolve
    split) — CR 305.1 lands never wait on the Stack, so there's no
    separate "resolve" step to pair it with, unlike a spell. It does the
    real Hand->Battlefield `state.move`, stamps `enteredThisTurn` (302.6
    summoning sickness — yes, a creature-land could still be sick) and
    `resolvedPermanents` (so upkeep/end-step auto-fire and Saga automation
    machinery would work on a land too, if a future one needed it) exactly
    like `resolveTop` already does for a cast permanent, derives
    `manaAbility` from the land's own `staticAbilities` text (so a
    mana-producing land like Midgar becomes a real payable mana source the
    instant it's played, not just when cast), fires the real
    `Trigger.on === 'enter'` ETB if the land declares one, then increments
    the counter.
  - **The dormant bug, actually fixed, not just flagged**: `canCastSpell`
    now rejects a Land typeLine outright, at the very top, before any
    other check — `castSpell` calls `canCastSpell` first, so this alone
    closes it for both; no separate check needed in `castSpell` itself.
    `engine-trace.ts`'s `pilotCast` needed NO direct edit either — it
    already just calls `canCastSpell`/`castSpell` and throws on
    `!check.ok`, so it inherits the guard for free (confirmed via the new
    "rejects a Land typeLine" describe block in `engine.test.ts` calling
    `castSpell` directly, plus reasoning through `pilotCast`'s own call
    chain — not separately unit-tested through `engine-trace.ts` itself,
    since nothing in this codebase exercises `pilotCast` against a Land
    today to make that concrete, same "no FIN land uses
    `runEngineScenarios()` yet" situation as everything else here).
  - `engine-trace.ts`: new `pilotPlayLand` (the `playLand`-equivalent of
    `pilotCast`+`pilotResolveTop` combined into one call, same reasoning)
    and `pilotExpectIllegalPlayLand` (the `playLand`-equivalent of
    `pilotExpectIllegalCast`) — both follow the exact same
    `beginStep`/legality-check-then-log-then-mutate shape every other
    `pilot*` helper in that file already uses, logging the same
    `{fn:'playLand',...}`/`{fn:'enters',...}`/`{fn:'trigger',...}` bracket
    shapes `harness.ts`'s own `lifecycleBefore` and `pilotResolveTop`
    already establish (so a future card that migrates to
    `runEngineScenarios()` produces a trace.json indistinguishable in
    shape from the harness-path one for the same events).
  - `engine.test.ts`: 8 new tests (`canPlayLand`/`playLand` describe
    block: rejects non-Land, legal play proves real zone move + no Stack
    trip + ETB fired (life gain) + counter increment, once-per-turn
    rejection with a mutate-nothing check, 305.3 timing rejection with a
    non-empty stack, 305.3 timing rejection outside main phase, Cleanup
    reset allowing a second land next turn; plus a `canCastSpell`/
    `castSpell` describe block proving the Land-rejection guard). All 178
    functional-model tests pass (170 pre-existing + 8 new); full-pool
    `verify-synergy.mjs` unchanged (still only the one pre-existing
    unrelated `auron-s-inspiration` failure); `npm run test` (whole repo)
    unchanged (still only the 5 pre-existing unrelated
    `scripts/relations.test.mjs` failures, a different domain/process).

  **Real, deliberately NOT closed in this pass, flagged for later**:
  Zell Dincht's own "You may play an additional land on each of your
  turns" (`staticAbilities`, freeform text) — `canPlayLand`'s once-per-turn
  check is a hardcoded `>= 1` (mirroring Forge's own default
  `getMaxLandPlays() == 1`), same "no FIN card modifies X yet" shape this
  codebase already accepts elsewhere (514.1's hardcoded 7-card hand size,
  e.g.) — but Zell is a REAL, checked exception (grepped the pool for
  "additional land"/"extra land"/"play two lands"/`maxLandPlays`; exactly
  one hit). Not closed here because it needs a structured field this
  engine can read (no `CardDefinition.extraLandPlays`-shaped field exists;
  Zell's own text is unstructured, same "engine-side design ready, blocked
  on `cards/*` boundary" situation ENGINE_GAPS.md's gap #8 damage-shields
  and gap #11's Vehicle crewCost gaps already document) — `RealPlayer.
  landsPlayedThisTurn`'s own new doc comment flags this explicitly so a
  future pass doesn't rediscover it from scratch. ENGINE_GAPS.md's own gap
  #12 entry needs updating to reflect this closure — not yet edited this
  pass (flagging here first per this file's own "record before finishing"
  convention; whoever picks this up next should mark gap #12 CLOSED in
  ENGINE_GAPS.md's own prioritized list, following the exact "~~old
  gap~~ **CLOSED**" strikethrough convention every other closed gap there
  already uses, and fold in this real Forge citation).
  Also NOT built: no FIN land currently exercises this real path (no
  card's own `scenarios.ts` migrated to `runEngineScenarios()` — out of
  this task's explicit scope, "you don't need to migrate any card").
     ability gains zero real benefit from more lands existing, unlike a
     genuine "lands matter" want.

- **2026-09-10 research (no code changed) — "cast a spell" fact-category
  gap, for a `castSpell` sibling to `playLand`**: findings only, nothing
  built.
  - **Trace level is ALREADY symmetric with `playLand`** — not a
    foundational gap. `harness.ts`'s `lifecycleBefore` (functional-model/
    harness.ts:920) emits `{fn:'cast', card, instanceId, from, cost}` for
    every non-Land, non-activation cast, same automatic-bracketing
    treatment `playLand` gets for lands (harness.ts:912); `engine-trace.ts`'s
    `pilotCast` (line 383) does the same for the piloted-engine path. The
    real gap is entirely one layer up, in the fact-vocabulary/`describeFact`
    layer, not the trace.
  - **`describeFact` (synergy.ts) has no dedicated `event==='cast*'`
    branch at all** — every cast-shaped fact today falls through to the
    generic string fallback (synergy.ts:523-535, which literally names
    `castCreatureSpell` as an example of what it's catching).
  - **Authored coverage is real but narrow and half-broken**: 6 cards use
    a named `onCast*` trigger (`grep "name: 'onCast" */definition.ts`) —
    `onCastCreatureSpell` (champions-of-the-perfect, the ONLY one wired:
    `TRIGGER_EVENT_MAP` in scripts/verify-synergy.mjs:264 maps it to a real
    `castCreatureSpell` sink fact), `onCastNoncreatureSpell` (shantotto-
    tactician-magician, tellah-great-sage, vivi-ornitier — NOT in
    `TRIGGER_EVENT_MAP` despite verify-synergy.mjs:261-263's comment
    implying it already is a wired convention; all three cards' own
    synergy.json `sink` is empty `[]` even though the trigger genuinely
    fires in trace.json — a real, silent authoring gap, not by design),
    `onCastSpellYouDontOwn` (vaan-street-thief — deliberately unmapped per
    SYNERGY_DESIGN.md:613-624, a produce-side trigger, no want needed),
    `onCastLegendarySpell` (venat-heart-of-hydaelyn — unmapped, NOT
    included in that same audited "no mapping needed" list, so its status
    is genuinely undetermined, not confirmed-deliberate).
  - `playLand`'s own shape to mirror: one dedicated harness/engine-trace
    log fn (`fn:'playLand'`, no `from`/`cost`) plus one dedicated
    `describeFact` branch (synergy.ts:481, `'play a land'`) — see
    synergy.ts:108-122's own doc comment for why `playLand` and
    `entersBattlefield` are deliberately two separate facts (the special
    action itself vs. the zone change), the same split a `castSpell`
    sibling should keep against `cast`'s own existing lifecycle `fn` and
    the (currently absent) `entersBattlefield`/`cast` fact pairing.
  - **Scope estimate**: 6 cards already have real cast-trigger machinery
    that could gain a fact for free once `castSpell`/`castCreatureSpell`/
    `castNoncreatureSpell` gets a real `describeFact` label + (for the 3
    `onCastNoncreatureSpell` cards) a `TRIGGER_EVENT_MAP` entry — no new
    authoring needed for those, just wiring. Separately, 11 cards have
    "whenever you/a player casts..."-shaped oracle/static text
    (`grep -li "whenever you cast\|whenever .* casts" */definition.ts`),
    a superset including the 6 above — the other 5
    (black-mage-s-rod, astrologian-s-planisphere, shambling-cie-th,
    queen-brahne, circle-of-power, the-prima-vista,
    lindblum-industrial-regency-mage-siege, red-mage-s-rapier,
    prompto-argentum — some of these may be *reacting* to a cast granting
    a keyword/ability rather than declaring their OWN cast trigger; not
    individually vetted this pass) are candidates for retroactive
    authoring once real vocabulary exists, not yet confirmed to need it.

- **2026-09-10 — `EventFact.recipient` added, damage direction fix
  (fin/1 Bahamut Mega Flare)**: `damage.controller` was 100% dealer-only
  pool-wide (23/23 real `event:'damage'` facts, all `controller:'you'`)
  while `lifeloss.controller` already means the RECIPIENT
  (summon-primal-odin) — same field, opposite semantics by event type.
  Fixed by ADDING a new optional `EventFact.recipient?: Side`
  (synergy.ts), documented as distinct from both `controller` (dealer/doer)
  and `target` (a `Constraints`-shaped permanent filter, `dies`/
  `putCounter`'s own use — not a `Side`, doesn't fit a player-recipient
  concept). Deliberately did NOT migrate `lifeloss`'s existing
  controller-as-recipient convention — left as a documented special case
  in `EventFact.controller`'s own doc comment (a real re-authoring pass
  across the pool's existing `lifeloss` facts is out of scope; only
  `recipient` is new vocabulary). `describeFact`'s `damage` branch is now
  its own named branch (was previously falling through to the generic
  fallback) — renders bare `"your damage"` when `recipient` is omitted
  (every pre-existing fact, unchanged), `"your damage to the opponent"`
  when declared. Authored `recipient: 'opp'` onto
  `cards/summon-bahamut/synergy.json`'s own `chapter-iv-damage` fact only
  (fin/1-scoped, per explicit instruction — no other card's damage fact
  touched). `verify-synergy.mjs` doesn't check `recipient` at all (it only
  compares `event`/`counterType`/`controller` against trace evidence), so
  it's inert to verification — confirmed 0 hard failures for both
  summon-bahamut and summon-primal-odin after the change (pre-existing
  soft notes only: `tapForMana`/LORE-counter/drawCard, unrelated).
  `synergy.test.ts` gained a dedicated `describeFact — damage` block
  (4 cases: no recipient, `recipient:'opp'`, `recipient:'you'`, recipient
  with no controller) rather than folding into the old generic-fallback
  test block, since damage is no longer generic-fallback. Full
  `functional-model` suite (228 tests) + `tsc --noEmit` clean after.
  **Flagged, not fixed (out of my lane)**: `app/lib/factConditions.ts`
  (card-owned, mirrors `describeFact`'s branch dispatch by hand per its
  own documented "known duplication risk") doesn't know about `damage`'s
  new named branch or `recipient` field yet — Bahamut's damage fact will
  show a redundant raw `{"recipient":"opp"}` in the Facts tab's condition
  column until `card` agent updates that file's `EVENTS_WITH_HAND_WRITTEN_LABEL`/
  hidden-field lists to match. Not a hidden-information bug (the doc's own
  stated worst case — "a field a hair too generously" shown), just
  cosmetic duplication.
  **Open Forge-verification**: none needed for this change — it's a
  synergy/vocabulary schema addition, not new engine mechanics; Bahamut's
  actual `dealDamage` engine behavior (card.ts's `case 'dealDamage'`) was
  already correct and unchanged, only the synergy fact's own label gained
  a way to state direction.

- **2026-09-10 — `self-counters` (`putCounter`) fact authored onto
  `cards/summon-bahamut/synergy.json`**, same self-cast/self-dies pattern:
  `{id:'self-counters', event:'putCounter', counterType:'LORE',
  target:'self', value:1, sourceText:'(As this Saga enters and after your
  draw step, add a lore counter. Sacrifice after IV.)'}`. Two things
  confirmed rather than guessed, per the task's own explicit ask:
  - `putCounter`'s self-reference field is `target` (an `EventFact` field),
    NOT `subject` (`subject` is the ZONE-fact self-reference field —
    `self-battlefield`/`self-sacrifice` on this same card use `subject`
    because they're zone facts; `self-cast`/`self-dies`/this new
    `self-counters` fact are event facts and all three use `target`).
    `effectiveController`/`describeFact`/`app/lib/factConditions.ts`'s own
    `isSelfReferencing` all branch on `EventFact.target === 'self'`
    specifically for this reason.
  - `counterType` must be `'LORE'` (uppercase), matching real trace
    evidence (`saga.ts`'s own `state.putCounter(real, 'LORE', 1)`,
    `engine-trace.ts`'s own `{fn:'putCounter', ..., counterType:'LORE'}`
    log entries) and the one other pool card that already declares this
    same counter type (`clash-of-the-eikons`'s own non-self-referencing
    `putCounterTarget` fact) — NOT lowercase `'lore'` as the task's own
    illustrative example spelled it; `verify-synergy.mjs`'s `counterType`
    comparison is case-sensitive plain equality (line ~651), so the wrong
    case would have produced a NEW hard failure instead of closing the
    existing soft note.
  - **No `producedEvent()`/trace gap existed this time** (unlike the
    `cast` case the task referenced as precedent) — `verify-synergy.mjs`'s
    `case 'putCounter':` branch (line 113) already existed and already
    correctly mapped a `{fn:'putCounter'}` log entry to `{event:
    'putCounter', counterType: entry.counterType}`; the pre-existing
    "trace has putCounter (...) with no matching declared produce" soft
    note for this card was purely a missing FACT, not a missing
    trace/verify-synergy vocabulary branch. Confirmed via a before/after
    `verify-synergy.mjs summon-bahamut` run: the 4 duplicate `putCounter`/
    LORE soft-note lines are gone after adding the fact, leaving only the
    unrelated pre-existing `tapForMana` soft notes (mana-payment logging,
    a separate known gap, out of scope here).
  - Regenerated `trace.json` via `run-scenarios.mjs --slug=summon-bahamut`
    as instructed — this incidentally also caught the file up to an
    EARLIER same-session `scenarios.ts` edit (the forced-self-destroy
    second scenario was removed from `scenarios.ts` itself already, per
    that file's own header comment, but the checked-in `trace.json` still
    had its old log entries until this regen) — not a regression I
    introduced, just stale generated output this task's own regen step
    happened to fix in passing.
  - Verified: `functional-model` vitest suite 216/216 pass; full-pool
    `verify-synergy.mjs` unchanged (still exactly 1 pre-existing unrelated
    hard failure, `auron-s-inspiration`); full-repo `npm run test`
    unchanged (still only the 5 pre-existing unrelated
    `scripts/relations.test.mjs`-domain failures). Confirmed live via the
    dev server's own `/api/card/fin/1` response (the `self-counters` fact
    is present, `role:'source'`) and a direct `describeFact()` call
    (`"LORE counters on itself"` — the bare, single-dimensional label this
    session's `putCounter` branch already produces) plus a read of
    `app/lib/factConditions.ts`'s `isSelfReferencing`/`(cardName)` branch
    confirming it fires for `target:'self'` event facts (so the Facts tab
    note renders `(Summon: Bahamut)` automatically, same as the `self-cast`
    fact from earlier this session — didn't independently re-verify in a
    live browser render, `card` agent's own lane if that specific pixel
    output needs a second look).
  - **No open Forge-verification** — pure synergy/vocabulary authoring
    onto an already-correct, already-cited engine mechanic (`saga.ts`'s
    real 714.2c lore-counter automation, unchanged).

- **2026-09-10, later same day — user OVERRODE the just-above `putCounter`
  design call**: `counterType` no longer stays in the label at all; the
  "distinct category in its own right" reasoning quoted at the top of that
  branch's own doc comment is retired. `describeFact`'s `putCounter` branch
  is now `return 'counters'` unconditionally — bare, no variation,
  consistent with every other single-dimensional label this session
  (`cast`/`dying`/`damage`/`sacrifice`/battlefield-graveyard-presence/
  lifegain/`addMana`/qualified-zone facts). Two changes, one on each side
  of the engine/card boundary:
  - `functional-model/synergy.ts`'s `describeFact` `putCounter` branch —
    comment rewritten, `kind`/template logic removed.
  - `app/lib/factConditions.ts` (card-owned, but the fix was a literal
    one-line guard removal the task explicitly authorized making the call
    on): `counterType` used to be suppressed there specifically FOR
    `putCounter` facts (`if (fact.counterType && fact.event !==
    'putCounter')`) — that carve-out existed only because the label used
    to show it there instead; removed the `fact.event !== 'putCounter'`
    guard so it now renders in the notes/conditions column for `putCounter`
    facts same as any other event that carries one. **Not silently
    guessed** — confirmed via a real `describeFact`/`factConditions` call
    against `cards/summon-bahamut/synergy.json`'s own `self-counters` fact
    (`{event:'putCounter', counterType:'LORE', target:'self', ...}`):
    label is now bare `"counters"` (was `"LORE counters"`), notes column
    is now `"self · LORE counters"` (was just `"self"` — `LORE` was fully
    invisible anywhere on the page before this fix, not just redundant).
  - Updated the two now-stale test files touching this: `synergy.test.ts`'s
    `putCounter` describeFact block (all cases now assert bare `'counters'`
    regardless of `counterType`/`controller`/`target`; added a `putCounter`
    case to the "every label branch is static" representative-fact sweep;
    fixed a comment in that sweep that named `putCounter`'s `counterType`
    as the one remaining verbatim-passthrough exception, since there isn't
    one anymore) and `app/lib/factConditions.test.ts`'s two `putCounter`/
    `counterType` cases (now expect `counterType` shown, not hidden).
  - Verified: `npx vitest run functional-model app/lib/factConditions.test.ts`
    — 235/235 pass. `npx tsc --noEmit` clean. Full-pool
    `verify-synergy.mjs` unchanged (still exactly 1 pre-existing unrelated
    hard failure, `auron-s-inspiration`; `counterType` isn't part of its
    own match/verify logic changing here, only the label template).
  - **No open Forge-verification** — pure label-presentation change, no
    engine mechanic or fact vocabulary touched.
