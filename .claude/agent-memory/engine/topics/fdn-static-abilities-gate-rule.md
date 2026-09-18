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
