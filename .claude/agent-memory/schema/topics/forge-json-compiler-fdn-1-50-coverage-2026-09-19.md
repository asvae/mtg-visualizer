# forge-json-compiler: FDN 1-50 coverage push (2026-09-19)

Task originally briefed as "FIN 1-50" (fixture-generation work done, see
below), corrected mid-task by the orchestrator to **FDN** 1-50 — FDN is
this project's own live `fdn-cards/` authoring pool, so every one of the
50 target cards already has a real hand-authored `definition.ts` to
cross-check against (FIN work was NOT wasted per the correction message,
just not the deliverable — see "FIN detour" below).

## Result: 2/50 -> 22/50 compile clean

Baseline (before any edits, verified against the ORIGINAL 2-card
`compile-forge-card.ts`): 2/50 (Fleeting Flight, Lunar Insight — both
pre-existing). Post-widening: 22/50 compile without throwing, classified
against real `fdn-cards/` references via `structuralDiff` into a 4-state
scheme (gray/blue/green/yellow — coordinator-specified mid-task, matches
this project's existing status-color meanings):
- **green (2, exact structural match)**: Fleeting Flight, Elementalist
  Adept.
- **yellow (20, compiles but diverges from the hand-authored reference)**:
  Sire of Seven Deaths, Armasaur Guide, Cat Collector, Claws Out,
  Dauntless Veteran, Guarded Heir, Helpful Hunter, Prideful Parent, Raise
  the Past, Vanguard Seraph, Bigfin Bouncer, Clinquant Skymage, Erudite
  Wizard, Grappling Kraken, Inspiration from Beyond, Kiora the Rising
  Tide, Lunar Insight, Mischievous Mystic, Refute, Skyship Buccaneer.
  Divergence reasons are almost all BENIGN/expected, not compiler bugs:
  compiler-minted `Trigger.name` never matches the human's pick (same
  known gap the original exemplar-of-light experiment already
  documented), `putCounter.target:{chosen:true}` vs the older sibling
  `putCounterTarget` kind (BOTH real, pool genuinely uses both for the
  identical Forge shape depending which card authored first), token
  `manaCost:''` vs authored `'0'` for a costless token (both valid).
  Skyship Buccaneer's own hand file is a stale pre-migration placeholder
  (flat `condition:'enters-battlefield'` string + no-op `custom` closure)
  — the compiler's OWN output is arguably MORE correct there, not the
  other way around.
- **gray (28)**: not attempted or genuinely unrepresentable — see gaps
  below. `blue` (compiled clean, no reference to diff against) doesn't
  occur in this run since all 50 have `fdn-cards/` references.

Full per-card table + the test asserting it: `functional-model/scripts/
experiments/forge-json-compiler/fdn-1-50.test.ts` (52 tests, all
passing — includes a coverage-summary-count assertion so a future
compiler change that flips any card's status must consciously update the
table, not just silently pass/fail).

## New DSL shapes added to `compile-forge-card.ts`

- Triggers: `Mode$ChangesZone` (self-ETB->`on:'enter'`, self-dies->
  `on:'dies'`, other-permanent-enters watch->`on:'otherPermanentEnters'`,
  other-creature-dies watch->`on:'otherCreatureDies'`, plus `CheckSVar$
  RaidTest`->`condition:{kind:'attackedThisTurn'}`), `Mode$Attacks` (+
  `Threshold$True`->`graveyardCountAtLeast`), `Mode$AttackersDeclared`,
  `Mode$Drawn`. `FirstTime$True`(+/-`PlayerTurn$True`)->
  `activationLimit:1` (verified against 2 real cards, Cat Collector +
  Vanguard Seraph, that already use each variant).
- Effects: `Discard`, `LoseLife`, `GainLife`, `Tap`->`tapTarget`,
  `Surveil`, `Counter`->`counter` (TargetType$Spell only), `Mill`,
  `PumpAll` (P/T-only, KW$ variant still out of scope), `Token`->
  `createToken` (real Forge tokenscript resolution, see below), `ChangeZone`/
  `ChangeZoneAll`->`move` (targeted bounce + untargeted library/graveyard
  search + `qty:100` "all" sentinel, matching `raise-the-past`'s own real
  precedent). `PutCounter | Defined$Targeted` now inherits validType+owner
  from the chain's own parent-targeting ability via a generalized
  `ChainContext` (was Pump-only before).
- Keyword K: lines: `Ward:PayLife<N>`->keywordCosts, `Kicker:<cost>`->
  keyword+keywordCosts, `Affinity:<type>`->`costReduction.perControlled`
  (NOT a Keyword at all), `Flashback:<cost>`->`alternateCosts` entry (NOT
  a Keyword either), bare `Prowess`, and Hare Apparent's own exact
  deckbuilding sentence (`/^A deck can have any number.../`) recognized
  and dropped (matches real `hare-apparent/definition.ts`'s own
  precedent — zero gameplay effect, not a new gap).
- `compileValidTgtsExtended`/`compileChangeType`: owner (`YouCtrl`/
  `OppCtrl`)+`notSelf` (`Other`/`StrictlyOther`)-aware parsers,
  generalizing the old bare-type-only `compileValidTgts`. `contextFromValidTgts`
  deliberately does NOT throw on an unrecognized type word (e.g. Refute's
  own `ValidTgts$ Card` on a `Counter` ability) — only sets inheritable
  chain context for the 4 known bare types, leaves anything else for the
  specific ability case to validate itself.
- Token resolution: `compile-forge-card.ts` stays IO-free (module-level
  `currentTokenScripts` scratch var, set/reset by `compileForgeCard`'s new
  optional 2nd param) — real IO lives in new sibling
  `load-token-scripts.ts`, reading `tmp/mtg-forge/forge-gui/res/
  tokenscripts/<id>.txt` directly (same DSL as a card script, narrower
  field set).

## Real bug caught by cross-checking against `fdn-cards/`, not by inspection

`ChangeZone`'s first version silently DROPPED `AlternativeDecider$`/
`DestinationAlternative$`/`LibraryPositionAlternative$` (Uncharted
Voyage's own real "top OR bottom of library, owner's choice") and
produced a plausible-looking but WRONG single-destination `move` effect
with no error at all. Caught only by diffing compiled output against the
real `uncharted-voyage/definition.ts` (a `custom` stub for exactly this
reason). Fixed by explicitly throwing on those 3 params. **Lesson: this
compiler's "throw on anything unhandled" design only works if every
consumed param list is actually exhaustive — cross-checking against real
authored references caught what code review alone didn't.**

## Genuine gaps left, NOT attempted (documented, not force-fit)

- `S:`/`R:` lines (11 cards) — static continuous abilities / replacement
  effects, categorically out of this narrow compiler's scope (asserted at
  the top of `compileForgeCard`, unchanged).
- Activated-ability `Cost$` translation (`AB$` root abilities — Coeurl-
  style, Squad Rallier, Abyssal Harvester).
- Planeswalker loyalty abilities (Kaito, Cunning Infiltrator — multi-`A:`
  `abilities[]` branch, plus an emblem-granting ultimate).
- Modal `Charm` root ability (Divine Resilience, Sun-Blessed Healer — both
  ALSO have an unrelated genuine gap each: unbounded "any number of
  targets," and an "if kicked" conditional-effect shape with no schema
  field).
- `CopyPermanent` ability (Homunculus Horde), `PermanentCreature` root
  ability (Arbiter of Woe — this is `fdn-cards/arbiter-of-woe/
  definition.ts`'s OWN already-declared `missingSchemaFunctionality`: a
  spell's own additional cast cost has no schema vocabulary at all; NOT a
  new gap this pass found).
- Comma OR-union `ValidTgts$`/`ValidCards$` (Joust Through's `Creature.
  attacking,Creature.blocking`, Sphinx of Forgotten Lore's `Instant.
  YouOwn,Sorcery.YouOwn`).
- Dynamic `SVar:X:Count$...` formula amounts (Hare Apparent's own
  named-self-count, several `+N/+N for each <type>` cards) — deliberately
  NOT built as a general `Count$`-expression compiler this pass (would be
  a materially bigger, separate effort).
- Felidar Savior's "each of up to N chosen targets" (`TargetMin$0|
  TargetMax$2`) — real hand-authored file uses `combinator.ts`'s
  `selectUpTo`/`applyToBound` program DSL; this mechanical per-ability
  translation table doesn't attempt to GENERATE combinator programs, only
  recognize flat `Effect` shapes. Real, bounded future work if this
  compiler ever gets built out further.

## Found-but-not-fixed authoring issues (flagged, out of THIS task's scope)

- `fdn-cards/mischievous-mystic/definition.ts` exports `mischiefousMystic`
  (typo, not `mischievousMystic`) — matched as-is in the test, not
  corrected.
- `fdn-cards/skyship-buccaneer/definition.ts` is a stale pre-migration
  placeholder (flat `condition:'enters-battlefield'` string, `kind:
  'custom'` no-op `run: () => {}`) — the real Raid mechanic IS
  representable today (`condition:{kind:'attackedThisTurn'}`, already
  used correctly by this compiler's own output) but the hand file was
  never migrated. A real, worthwhile future authoring-pass fix — same
  "false-positive stale claim" pattern the 2026-09-18 pass already found
  elsewhere (see `false-positive-gap-fixes-2026-09-18.md`).

## `forge_json_mapper.py` fix (general, not FDN-specific)

`slugify()` stripped `/` as a "special character" instead of treating it
as a separator (same as space/hyphen) — broke resolving "Summon: Choco/
Mog" (a real FIN card, found during the pre-correction FIN detour, kept
since it's a genuine bug affecting ANY future name containing `/`, verified
against 2 real cardsfolder filenames: `sp_dr_piloted_by_peni.txt` and
`summon_choco_mog.txt`). Full FDN 517-card `resolve_fdn_cards()` re-run
confirmed zero regressions from this fix.

## FIN detour (pre-correction, not the deliverable)

Before the orchestrator's mid-task correction, this same work was done
against FIN 1-50 instead (wrong corpus per the user's actual intent) —
produced `forge-json-compiler/fixtures/fin-1-50/` (50 real Forge JSONs,
via a new `generate-fin-1-50.py`) and a FIN-scoped coverage analysis.
Both DELETED once the correction landed (not the deliverable, would
otherwise clutter the experiment dir) — only the `slugify()` fix survived
the detour, since it's a real, general bug independent of which corpus is
targeted.

## Files

- `functional-model/scripts/experiments/forge-json-compiler/
  compile-forge-card.ts` — widened (see above).
- `functional-model/scripts/experiments/forge-json-compiler/
  load-token-scripts.ts` — NEW, token-script IO.
- `functional-model/scripts/experiments/forge-json-compiler/
  fdn-1-50.test.ts` — NEW, the 52-test regression guard.
- `functional-model/scripts/experiments/forge-json-mapper/
  forge_json_mapper.py` — `slugify()` fix only.

## Follow-up: 2 open conventions resolved by pool-wide majority count -> now 1 green / 21 yellow

Orchestrator settled the 2 open "which shape is canonical" questions by
checking real usage across ALL of `fdn-cards/` (not just this 50-card
slice) rather than asking the user — clear majorities both times, no
ambiguity: `putCounterTarget` (12x) over `putCounter.target:{chosen:true}`
(2x); token `manaCost:'0'` (23x) over `manaCost:''` (2x). Fixed
`compile-forge-card.ts` to default to the majority shape in both cases
(the `ValidTgts$` direct-target `PutCounter` branch now returns
`putCounterTarget`; `resolveTokenScript` now maps an empty compiled
`manaCost` to `'0'`). Trigger.name minting (the 3rd open question) was
correctly left alone — see below, it's not actually the nitpick it was
framed as.

**Result: 2 green / 20 yellow -> 1 green / 21 yellow, NOT the expected
"most of the 20 collapse to green."** Real, measured cause (compared
before/after diffs per yellow card directly, not just trusted the
counts): `compileTrigger` unconditionally emits the NEWER nested
`Trigger{cause:{on,...}}` shape (`card.ts`'s 2026-09-19 `Trigger`/
`TriggerOld` split), but only Exemplar of Light (outside this 50-card
slice) has actually been migrated to it — every other real FDN 1-50 card
still uses the OLDER flat `TriggerOld{on,...}`. That ONE systematic gap
dominates literally every trigger-bearing yellow card's own diff list
(the `cause`/`on` lines), independent of and much bigger than the
Trigger.name-spelling nitpick the "keep the compiler's minting rule as
canonical" framing was actually about. Confirmed both fixes are real,
correct, verified improvements anyway (not wasted): diffed the exact
before/after per-card output directly —
`armasaur_guide` 8->4 diffs, `cat_collector` 9->7, `guarded_heir` 4->3,
`kiora_the_rising_tide` 8->7, `mischievous_mystic` 5->4 (each lost either
the `putCounterTarget` mismatch or a token-manaCost mismatch line) — just
none dropped to 0 because the `Trigger.cause` gap remains in every one of
them. `prideful_parent` got 1 diff WORSE (3->4): its own
`fdn-cards/prideful-parent/definition.ts` is one of the 2 real minority-
convention outliers (`manaCost:''`), so the majority-convention fix
correctly moved the compiler AWAY from matching this one specific card —
expected, not a bug, now documented on its own table entry.

**Fleeting Flight (one of the original 2 greens) flipped to yellow** —
its own `fdn-cards/fleeting-flight/definition.ts` was deliberately
migrated to the unified `putCounter.target:{chosen:true}}` shape earlier
THE SAME DAY (`card.ts`'s "putCounter unification" pass, flagship
real-card example) — i.e. it's the genuine minority-shape outlier the new
majority-convention default now diverges from, the mirror image of the
Armasaur Guide situation the ORIGINAL table's own doc comment already
called out (that comment was itself already describing this exact tension,
just before the default flipped which side of it was "yellow"). Flagged
prominently rather than silently accepted, since confirming the 2
original greens didn't regress was an explicit part of this follow-up's
own ask — one of them genuinely did, for a real, understood, documented
reason.

Updated: `fdn-1-50-cases.ts`'s own header doc comment (replaced the
Armasaur-Guide-specific "two shapes both happen" framing with the real
`Trigger.cause`-dominance explanation), Fleeting Flight's status
(`green`->`yellow`, `putCounterTarget` fix decision was Track for this)
+ a new NOTE, Prideful Parent's own new NOTE, and both files' hardcoded
coverage-summary counts (`fdn-1-50.test.ts`'s assertion + title,
`fdn-1-50-cases.ts`'s header comment don't separately hardcode the count).
`server/utils/forgeJsonCompiler.ts` (the concurrent `card`-agent work
extending the card-page "Forge Compiler" tab) reads `CASES` dynamically
by filtering `status`, so it needed zero edits — the status flip flows
through automatically.

Verified: `npx vitest run functional-model/scripts/experiments/
forge-json-compiler/fdn-1-50.test.ts` — 52/52 pass (all card statuses +
the coverage-summary-count assertion, now `{gray:28, blue:0, green:1,
yellow:21}`). Full `npx vitest run functional-model` — same pre-existing
1-failure baseline (Ajani's Pridemate categories, unrelated). `npm run
typecheck` — exact pre-existing 11-diagnostic baseline, zero new.

## Follow-up 2: user correction — drop green/yellow entirely, 2-state scheme only

Real user correction (not the schema agent's own call): the whole
green-vs-yellow reference-diff question against `fdn-cards/`'s own
separately-authored pipeline files was NEVER the real question this
experiment answers — only "did it compile into a schema-valid
`CardDefinition`, yes or no" matters. This makes the entire "Follow-up 1"
section above's own investigation (why yellow cases didn't collapse to
green, the `Trigger.cause`-vs-`TriggerOld` migration gap) MOOT as a
blocking/gating concern — kept in this file as a real, accurate technical
finding (the `Trigger.cause` gap is still real and still explains every
remaining structural diff), just no longer something worth scheduling or
tracking, since nothing is gated on `structuralDiff` anymore.

Changes: `CompileStatus` narrowed to `'gray' | 'blue'` (dropped `'green'`/
`'yellow'`). Recounted for real rather than reusing the old 22 (confirmed
the 2 compiler fixes never changed which cards throw vs. compile — they
only affected the FIELD SHAPE of already-successful compiles): every
previously green/yellow card -> `blue`, unchanged 22 blue / 28 gray split.
Removed the 2 status-flip NOTE comments (Fleeting Flight, Prideful Parent)
from `fdn-1-50-cases.ts` — they were explaining a green->yellow transition
that no longer exists as a concept; kept the Mischievous Mystic
export-name-typo NOTE (still needed context for `exportName`, unrelated to
scoring). Rewrote both files' header doc comments for the 2-state scheme,
explicitly keeping `structuralDiff` as DIAGNOSTIC-only (still computed per
`blue` card in `fdn-1-50.test.ts`, never asserted on) since it already
caught one real compiler bug this same day (Uncharted Voyage's
`AlternativeDecider$` silent drop) and remains genuinely useful for that.
`fdn-1-50.test.ts`'s coverage-summary assertion -> `{gray:28, blue:22}`.

`server/utils/forgeJsonCompiler.ts` (concurrent `card`-agent "Forge
Compiler" tab work) needed a mechanical fix too (`c.status === 'green' ||
c.status === 'yellow'` -> now referencing `'blue'`) since its filter
compared against literals the narrowed `CompileStatus` union no longer
has — would have been a real typecheck break otherwise. Made the minimal
one-line fix; the `card` agent then independently landed its own, more
thorough concurrent rewrite of that same file (dropped the `fdnSlug`/diff
concept from the tab entirely, matching this same correction) which
superseded my one-line patch — confirmed no conflict, final state
typechecks clean.

Verified: `npx vitest run .../fdn-1-50.test.ts` 52/52 pass. Full `npx
vitest run functional-model` — same pre-existing 1-failure baseline
(Ajani's Pridemate, unrelated). `npm run typecheck` — exact pre-existing
11-diagnostic baseline, zero new (confirms both my edit and the
concurrent `card`-agent rewrite of `forgeJsonCompiler.ts` compile clean
together).
