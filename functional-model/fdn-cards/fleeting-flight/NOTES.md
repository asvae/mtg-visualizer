# Fleeting Flight — authoring notes

## Authoring background

"Prevent all combat damage that would be dealt to it this turn" is a real
CR 614.2 replacement effect — ENGINE_GAPS.md gap #8 documents this class
of gap as CLOSED for a narrow real subset, via the `'CombatDamagePrevention'`
`Keyword` (checked at `state.dealDamage`'s one real chokepoint, gated on
`opts.combat`, via `effectiveKeywords` so a GRANTED shield is exactly as
real as a printed one). This card's own instance is a targeted, until-
end-of-turn GRANT of that same keyword — `grantKeywordTarget({keyword:
'CombatDamagePrevention', untilEndOfTurn: true})` — no new vocabulary
needed; the earlier inert `custom` no-op placeholder was replaced with
this real effect (2026-09-18, coverage-justification authoring pass).

(Was flagged during the 2026-09-18 comment-cleanup sweep as documented-
only-in-prose with no real backing effect or `missingSchemaFunctionality`
entry — resolved, not a genuine capacity gap after all: the existing
`CombatDamagePrevention` keyword machinery covers it exactly.)
