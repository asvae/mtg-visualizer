# FDN gate: any non-empty `staticAbilities` caps a card at `purple` (2026-09-18)

Real bug found: `inspiring-paladin` had a WHOLE real ability
("creatures you control with +1/+1 counters on them have first strike")
left completely unmodeled — only free-text `staticAbilities` + a code
comment admitting the gap — yet `validate-card-definition.mjs` returned
`ok:true`/`blue`. Root cause confirmed in the actual gate script (not
assumed): the gate only checks that whatever `Effect`/combinator `kind`s
ARE used are real/known (`findVocabularyGaps` — `card-status.ts`'s
`findUnsupportedConstructs` + `card.ts`'s `synergyTags` + `combinator.ts`'s
`walkProgram`); a `staticAbilities` string has no structural marker at
all, so an entirely-unbacked clause there is invisible to it.
`card-status.ts`'s own `isUnsupportedNoOp` doc comment already named this
exact case as a "known, accepted blind spot," just never enforced against.

**Fix shipped (per explicit user ruling, superseding the original,
fuzzier "does this specific entry lack a functional counterpart"
brief)**: a fully general oracle-text-vs-effects match isn't feasible;
instead the gate now has one blunt, deterministic rule —
`findStaticAbilityGapReasons` (`functional-model/scripts/
validate-card-definition.mjs`, exported for direct unit testing, see
`functional-model/validate-card-definition.test.ts`) walks BOTH faces and
treats ANY non-empty `staticAbilities` array as an automatic
`failureKind:'capacity-gap'` (→ `purple`), one reason per entry, merged
into the same result the vocabulary walk already produces — even when
another part of the SAME card models that identical clause correctly
elsewhere (Inspiring Paladin's own first ability is exactly that case).
No second condition, no per-entry judgment call.

**Pool-wide effect** (`gate-and-write-status.mjs --all` rerun): 16 cards
flipped `blue` → `purple` (all newly caught, `staticAbilities`-presence
only): `inspiring-paladin`, `arbiter-of-woe`, `billowing-shriekmass`,
`blasphemous-edict`, `cephalid-inkmage`, `crypt-feaster`,
`crystal-barricade`, `drake-hatcher`, `elementalist-adept`,
`gutless-plunderer`, `herald-of-eternal-dawn`, `midnight-snack`,
`skyknight-squire`, `sun-blessed-healer`, `twinblade-blessing`,
`vampire-soulcaller` — plus `tinybones-bauble-burglar` (already `purple`
for an unrelated `custom` no-op, gained a second real reason). New totals:
69 blue / 31 purple / 0 other / 0 missing (was 85/15). Every
`pipeline-status.json` in the pool got rewritten (fresh `computedAt`,
harmless — the script's own designed "safe to re-run" behavior).

**Not (re-)verified against Forge as part of this fix**: the 16 newly
`purple` cards' own `staticAbilities` text (Threshold/Prowess/Raid/Kicker/
etc.) was cheap-tier-transcribed, not independently re-checked against
`tmp/mtg-forge` line-by-line as part of THIS task — that remains the
same, already-known, separate open item this whole authoring pipeline
already carries (see `fdn-cheap-tier-vocabulary-mistakes.md`), not
something this gate change newly introduces or resolves.

## Two more silent-gap classes found (2026-09-18, later same day)

**Ward's cost payload has no schema home at all.** `Keyword` is a bare
string union — zero cost-payload field for Ward or any other keyword.
`sire-of-seven-deaths` ("Ward—Pay 7 life") and `zul-ashur-lich-lord`
("Ward—Pay 2 life") had this real non-default cost sitting only in a
code comment (gate-invisible) — fixed the same way as Inspiring Paladin,
via a `staticAbilities` entry naming the specific cost text (reuses the
existing rule above, zero new gate code). Both `blue`→`purple`. Swept
the full 100-card pool against real cached Scryfall oracle text
(`functional-model/.fdn-scratch/<slug>/scryfall.json`) for other
cost-bearing keywords (Equip/Cycling/Kicker/Ninjutsu/Boast/etc.) — Ward
was the only real instance; Flashback already has a proper structured
home (`alternateCosts`/`flashback()`) so it's not affected.

**Arahbo, the First Fang: a real, validly-typed value with under-scoped
real coverage.** "Whenever Arahbo or another nontoken Cat you control
enters" was modeled as `on:'enter'`, which is genuinely correct for
"Arahbo enters" but structurally CANNOT fire for "another Cat enters" —
`on:'enter'` fires per-registration on the permanent itself, not as a
board-wide predicate scan. Not a wrong value, a real value covering only
part of the printed clause. Fixed the same way (a `staticAbilities`
entry for the uncovered half). This is a genuinely different failure
shape than Ward's — see below.

**Is a general oracle-text-vs-definition coverage check feasible?
No, not as one deterministic gate**, and these two bugs are the concrete
evidence why — they're different failure shapes:
- Ward-class ("a value is silently missing"): the gate only ever sees
  the imported runtime object, never real oracle text — a bare
  `keywords:['Ward']` is structurally identical whether it correctly
  captures a default cost or silently drops a real one. Gate-catchable
  today with **zero new code**, but only once an author writes the gap
  down in `staticAbilities` — there's no way to derive it from the
  object shape alone. A narrow *future* gate is plausible though: flag
  (warn, don't fail) any card whose cached oracle text matches a fixed
  cost-suffix pattern (`Ward—`, `Equip {`, `Cycling {`, ...) with no
  structural reference to that cost anywhere (`keywords`/
  `staticAbilities`/`alternateCosts`/`abilities[].cost`) — proposed, not
  built.
- Arahbo-class ("a real value's scope is narrower than the real
  clause"): requires judging what the English text actually means vs.
  what the code covers — genuinely not gate-scriptable. Recommended as a
  **smart-tier review checklist item** instead ("does every real clause
  have some functional counterpart, even partial — and if partial, is
  the gap flagged rather than silent?"), never a script.

**Also flagged, not fixed**: `divine-resilience`'s `keywords:['Kicker']`
is a live `tsc` type error (`Kicker` isn't a real `Keyword` union member)
currently MASKED because the gate short-circuits on an earlier capacity
gap before reaching the type-check step — harmless while that other gap
stands, but will surface the moment it's ever closed first. Not urgent,
just don't be surprised by it later.

## Fourth silent-gap class: name-only `Trigger` (no real `on` value) — FDN-only rule (2026-09-18, later same day again)

A `Trigger` with no `on` field (`card.ts`'s real closed union: `'enter' |
'upkeep' | 'endStep' | 'tapLandForMana' | 'attacks' | 'equippedAttacks'`
is the ONLY thing that makes a trigger auto-fire inside `engine.ts`) is a
real, pervasive, and — critically — **legitimate** convention across the
FIN pool: 205 live instances confirmed across `functional-model/cards/`,
each backed by a real `scenarios.ts` that names the trigger explicitly via
`harness.ts`'s own `Scenario.trigger`/`sequence` fields and gets verified
through real trace evidence. `Trigger.on`'s own doc comment says this
outright ("picked manually per scenario... unaffected by this"). **Not**
flagged, and shouldn't be — this rule only ever runs against
`functional-model/fdn-cards/` (this whole gate file is only ever imported
by `gate-and-write-status.mjs`, which never walks `cards/`).

The FDN pool is categorically different: an FDN card has ONLY
`definition.ts` + `pipeline-status.json` by design — **no `scenarios.ts`
exists for any FDN card**, so a name-only trigger there has zero path to
ever execute, manual or automatic. Every "modeled as a named trigger for
manual scenario invocation" code comment across the FDN pool is simply
false as things stand — there is no scenario file to invoke it manually
with. Checked all 28 real current FDN name-only-trigger instances
individually — no legitimate exception category found (a few carry
harmless extra `description`/`describe` fields not part of the real
`Trigger` type, already masked-type-error territory like the Kicker case
above, not itself part of this rule).

**Fix shipped**: `findNameOnlyTriggerGapReasons` (same file, same
`findStaticAbilityGapReasons`-shaped export/dual-face walk, unit-tested in
`validate-card-definition.test.ts`) — any `Trigger` with no `on` on either
face is one more `capacity-gap` reason, folded into the same combined
result. Quotes the trigger's own `name` (falls back to `"(unnamed
trigger)"` — `tinybones-bauble-burglar`'s own trigger is missing `name`
entirely, a separate pre-existing masked type bug, not fixed here) plus
its `description`/`describe` field when present.

**Pool-wide effect** (`gate-and-write-status.mjs`, run against 99 of the
100 real FDN slugs — `hare-apparent` deliberately excluded/deferred, see
below): 21 more cards flipped `blue` -> `purple`: `ajani-s-pridemate`,
`archmage-of-runes`, `armasaur-guide`, `battlesong-berserker`,
`bloodthirsty-conqueror`, `cat-collector`, `clinquant-skymage`,
`courageous-goblin`, `crackling-cyclops`, `dazzling-angel`,
`erudite-wizard`, `exemplar-of-light`, `grappling-kraken`,
`high-society-hunter`, `infernal-vessel`, `infestation-sage`,
`mischievous-mystic`, `nine-lives-familiar`, `valkyrie-s-call`,
`vanguard-seraph`, `vengeful-bloodwitch` — `courageous-goblin` is the
cleanest real bug of the batch (no OTHER gap masking it: real
`pumpSelf`/`grantKeywordSelf` effects, zero `staticAbilities`, yet the
whole trigger can never fire). New totals across those 99 slugs: 45 blue /
54 purple (was 66/33). A handful of already-`purple` cards
(`drake-hatcher`, `homunculus-horde`, `kaito-cunning-infiltrator`,
`skyship-buccaneer`, `sphinx-of-forgotten-lore`,
`tinybones-bauble-burglar`) gained one more reason without changing
status.

**`hare-apparent` deliberately NOT re-gated this pass** — a concurrent
`engine` agent session was mid-edit on its `definition.ts`/
`pipeline-status.json` (and `sink-model/*`/`combinator.ts`/`card.ts`,
confirmed via `git status` both before starting and immediately before
the batch gate run) at the time of this task. Re-run
`gate-and-write-status.mjs hare-apparent` once that other work lands, to
pick up both this new rule and whatever that session's own edit changed.
