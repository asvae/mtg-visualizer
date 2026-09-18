# Gutless Plunderer — authoring notes

## Authoring background

Real Raid — the "you attacked this turn" gate is now a real
`Trigger.condition` (`BoardStateCondition.kind:'attackedThisTurn'`,
2026-09-18 schema-completeness pass) — declaratively real but NOT itself
engine-enforced yet (same real gap Midnight Snack's own Raid clause
names, Ward pattern — see `engine-support-registry.ts`'s own
`board-state-condition-not-enforced` entry), so this creature's own `dig`
effect still fires on every ETB in practice, same as before this field
existed; the real gate is now at least structurally declared instead of
silently approximated as always-on.
