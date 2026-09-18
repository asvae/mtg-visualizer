# Sylvan Scavenging — authoring notes

## Authoring background

Real Forge (sylvan_scavenging.txt): `SVar:DBToken:DB$ Token | ... |
ConditionPresent$ Creature.powerGE4+YouCtrl` — mode 2's token creation is
gated on "you control a creature with power 4 or greater." No
Query/Filter/Aggregate predicate reads a creature's own POWER (only
`subtype`/`cardType`/`excludeSelf`/`sameNameAsSelf`, and `Aggregate`'s
own `sum(field:'power')` totals a whole pool rather than testing any
single member) — kept as an unconditional token creation (same
"documented pre-existing unconditional approximation" precedent
`billowing-shriekmass`'s own Threshold P/T bonus already establishes),
with the real gap declared rather than silently dropped.
