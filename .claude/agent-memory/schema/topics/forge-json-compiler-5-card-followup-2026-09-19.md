# forge-json-compiler: 5-card follow-up pass (Squad Rallier / Valkyrie's Call / Crystal Barricade / Twinblade Blessing / Herald of Eternal Dawn)

Real per-card investigation (not the task's own initial generic framing,
which undersold at least 2 of the 5) — pool now **25 blue / 25 gray** of
FDN 1-50 (`fdn-1-50-cases.ts`, `fdn-1-50.test.ts`).

## Squad Rallier — COMPILED (now blue)

Needed BOTH a Cost$→`activationCost` translation (new `compileActivationCost`,
mana-symbol-only, throws on any non-mana `Cost$` token) AND a brand new
`Dig` case in `compileAbilityEffects` — the task only flagged the first;
`Dig` had NO case at all before this pass. `Dig`'s own `ChangeValid$
Creature.powerLE2` needed real new `card.ts` schema vocabulary: `dig`
gained a bare `'creature'` `validType` option + a new `powerLE?: number`
field (real Forge `CardProperty.java`'s generic `power<comparator><N>`
shape, `LE` only). This ALSO fixed a real, previously-flagged, undeclared
approximation in the old hand-authored `squad-rallier/definition.ts`
(`validType:'creature-or-artifact'` used as a stand-in, flagged in its own
NOTES.md as an undeclared gap) — NOTES.md rewritten to reflect the real
fix, not left stale.

`powerLE` is declaratively real but NOT YET engine-enforced (`Actions.dig`
has no such param) — new `engine-support-registry.ts` entry
`dig-power-filter-not-enforced`, seeded by this card
(`pipeline-status.json` → `engineSupport: 'off'`).

## Valkyrie's Call — the `nonAngel` fix landed, but a MUCH deeper gap remains (still gray)

Confirmed the task's own claim: Forge's `nonAngel` really is the GENERIC
`non<Type>` restriction word (`CardStateProperty.java`'s own
`property.startsWith("non")` → `!type.hasStringType(property.substring(3))`
— matches ANY type/subtype word, not a fixed enum). Added
`otherCreatureDiesMatch.excludeSubtype?: string` (mirrors
`otherPermanentEntersMatch.subtype`'s naming) + a generic
`/^non([A-Z][A-Za-z]*)$/` regex in the trigger-cause compiler (both
`TriggerOld` and the new nested `Trigger`/`TriggerCause` shapes updated).
Covered by the EXISTING `fdn-trigger-cluster-not-enforced` registry entry
(keys off `on` value only, not match-field shape) — no new registry entry
needed.

**But this fix alone does NOT make the card compile.** Real investigation
(NOT assumed from the task brief) found Valkyrie's Call's own `Execute$`
chain is `DB$ ChangeZone | Defined$ TriggeredCard | WithCountersType$
P1P1 | StaticEffect$ Animate` (return the just-died card to the
battlefield, put a +1/+1 counter on it, AND give that ONE specific
returned object — not a board-wide predicate match — a linked, Oblivion-
Ring-style continuous type/keyword grant via `Card.IsRemembered`). Grepped
`card.ts`: **zero** existing vocabulary for `Defined$ TriggeredCard`, a
counter-bearing `ChangeZone`, or an instance-scoped (not predicate-scoped)
continuous grant — this is categorically different from
`continuousKeywordGrants`'s predicate/subtype-based recipient resolution.
Confirmed by actually running the compiler: after the `nonAngel` fix it
throws one step later, at `ChangeZone with neither ValidTgts$ nor
ChangeType$` — the genuine remaining blocker.

**Flag for `engine`/orchestrator**: this needs a real design decision (a
"remembered object" instance-scoped continuous-grant mechanism + a
counter-bearing/"the card that triggered this" move effect) — not
attempted here, deliberately, per the "don't force new vocabulary
unilaterally for one rare card" guidance. No `SendMessage` tool available
in this subagent's toolset — surfaced via the task handback instead.

## Crystal Barricade — genuinely still blocked (still gray), confirmed via real code

Real Forge JSON has BOTH an `S:` line (`Mode:Continuous, Affected:'You',
AddKeyword:'Hexproof'` — a PLAYER-level grant) AND an `R:` line ("prevent
all noncombat damage that would be dealt to OTHER creatures you control").
The already-hand-authored `crystal-barricade/definition.ts` already
declares BOTH as `missingSchemaFunctionality` (no player-level grant
field anywhere; no CR-614.2-style "noncombat-only, broadcast to others"
damage-prevention replacement effect exists either) — this pass's own new
`compileStaticAbilityKeywordGrant` (see Twinblade Blessing below)
correctly throws on `Affected$ You` (only `Creature.EnchantedBy` is
recognized), and `R:` stays a blanket throw. Verified by actually running
the compiler post-fix: still throws, on the `R:` line. No forcing
attempted — matches the existing hand-authored precedent's own honest
conclusion.

## Twinblade Blessing — COMPILED (now blue), real precedent existed

`Mode$ Continuous | Affected$ Creature.EnchantedBy | AddKeyword$ <kw>` →
`continuousKeywordGrants` + `equippedBySelf: true` was ALREADY the real,
already-hand-authored shape on this exact card (and Sleep Magic, FIN) —
new `compileStaticAbilityKeywordGrant` recognizes only this one real
`Affected$` value (throws on anything else, e.g. Crystal Barricade's
`Affected$ You` above). `K:Enchant:Creature` needed a NEW kind of
translation — not a `keywords`/`keywordCosts` field like Ward/Affinity/
Flashback/Kicker, but a whole synthesized `onEnter` trigger
(`extractEnchantCreatureKLine` + `enchantCreatureAttachTrigger`) —
reproduces the EXACT closure body already used by both Twinblade
Blessing's and Sleep Magic's own hand-authored files (real, deterministic
1:1 translation, not new invented logic — the whole real behavior of
`Enchant:Creature` is identical on every Aura that has it).

**Real functional-effect-writing complication, now fixed properly**:
`write-fdn-definition.ts`'s serializer couldn't handle a function VALUE at
all at first. First attempt (`Function.prototype.toString()`) was WRONG —
under `vite-node`/esbuild-transpiled runtime it reflects the COMPILED JS
(double-quoted strings, stripped type annotations, tab indent), not the
original TypeScript. Fixed properly: `write-fdn-definition.ts` now reads
`compile-forge-card.ts`'s OWN `.ts` source file via the real TypeScript
compiler API (`ts.createSourceFile` + AST walk), extracts the exact
`run:` initializer text keyed by its sibling `describe` string
(`loadCustomEffectRunSources`), and re-indents it — single source of
truth, zero drift risk, output now IS the real single-quoted/typed
source. Only one entry exists (`'attaches to enchanted creature'`);
throws, honestly, if a future custom-effect closure isn't in this lookup
— extend it, don't fall back to a lossy `toString()`.

## Herald of Eternal Dawn — genuinely blocked (still gray), confirmed no precedent anywhere

Two `R:` lines, `Event:GameLoss`/`Event:GameWin`, `Layer:CantHappen`
("you can't lose, opponents can't win" — Platinum Angel pattern). Grepped
the WHOLE pool (`fdn-cards`+`cards`) for `GameLoss`/`GameWin`/`CantHappen`
— every OTHER real `Layer$ CantHappen` use in this pool is a DIFFERENT
mechanism (`'CantUntap'`, "can't be countered," none touch a
win/loss check). The card's own already-hand-authored `definition.ts`
already carries exactly this conclusion as its own
`missingSchemaFunctionality` entry ("no mechanism anywhere in this engine
intercepts/suppresses a 704 game-loss or 104 game-win check for a
specific player"). Genuinely rare/bespoke — real design decision needed,
not attempted, per task's own explicit permission to leave this one as an
honest gap report.

## Mechanics of the pass

- `card.ts` touched (real schema-authoring, not compiler-only): `dig`
  gained `'creature'` `validType` + `powerLE?: number`;
  `otherCreatureDiesMatch` (both shapes) gained `excludeSubtype?: string`.
- New `engine-support-registry.ts` entry: `dig-power-filter-not-enforced`
  (+ 2 new unit tests + the seeded-ID-list test updated).
- `fdn-1-50-cases.ts`: Squad Rallier (cn 24) + Twinblade Blessing (cn 26)
  flipped to `blue`. `fdn-1-50.test.ts`'s coverage assertion updated to
  `{gray: 25, blue: 25}`. `compile-forge-card.ts`'s own header docstring
  count updated too (was already stale at "22" before this pass).
- Regenerated `fdn-cards/{squad-rallier,twinblade-blessing}/definition.ts`
  via `author-fdn-definitions.ts`, re-gated via
  `gate-and-write-status.mjs` (both → real `blue`, fresh `computedAt`,
  leveraging the concurrent same-day `provenance` justification-waiver —
  no new `justification.json` needed for either).
- Full `npx tsc --noEmit -p .` clean; `functional-model/` vitest suite:
  only ONE pre-existing, unrelated failure remains
  (`card-interactions.test.ts`'s Ajani's Pridemate/+1/+1 case — touches
  files (`matcher-model/catalog/counters-plus1plus1.ts` etc.) that were
  ALREADY staged/modified by a concurrent agent's in-flight matcher-model
  work before this task started; not caused by anything in this pass, not
  fixed here — out of this task's scope and risked colliding with that
  concurrent work).
