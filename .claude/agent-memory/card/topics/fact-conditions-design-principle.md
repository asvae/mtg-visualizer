# `app/lib/factConditions.ts`: exclusion-list, never allow-list

The Facts-tab conditions/notes column (`factConditions(fact)`) must render
a `Fact` field automatically unless it's explicitly known to be redundant
with something else already shown on the same row (the role icon, the
bare `describeFact` label, the ValueBar). It was originally an **allow-list**
(`CONDITION_KEYS`) and that caused a real, live bug: a real field
(`subject`) was silently never shown for months because the allow-list was
never updated for it. It is now an **exclusion-list**
(`HIDDEN_FACT_KEYS`/similar) — every field not explicitly hidden shows,
including any brand-new field added to the `Fact` schema later, with zero
change to this file required.

**The safe direction to be wrong in this file is over-showing, never
hiding.** A missed exclusion case shows a field too generously (mildly
noisy); a missed inclusion silently drops real information forever,
undetectably. When adding a new hide-rule here, verify it against the real
corpus (grep `synergy.json` for the field/branch in question) rather than
trusting a secondhand description of which `describeFact` branches fold
which fields — this file has been burned twice by trusting an
inaccurate-in-detail recollection instead of re-reading `describeFact`
directly (e.g. "controller is always folded" turned out false for several
real event branches; "`types` is always folded" turned out false for the
`.not` case).

`describeFact()`/`constraintBits()` themselves are engine-owned
(`functional-model/synergy.ts`) — `.claude/contracts/card-schema.md` flags
the fact that this file already imports `describeFact`/`isZoneFact`
directly as a standing, deliberately-tolerated boundary violation, but says
not to add MORE engine-owned functions to that import going forward.
`factConditions.ts` keeps small local duplicates (`typeBits`/`ZONE_NOUN`/
`effectiveZone`-equivalent) of engine-internal helpers it needs, rather
than importing them — a deliberate, repeated trade in this file, not an
oversight.
