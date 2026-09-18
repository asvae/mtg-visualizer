# Midnight Snack — authoring notes

## Authoring background

Real Raid — the "you attacked this turn" gate is now a real
`Trigger.condition` (`BoardStateCondition.kind:'attackedThisTurn'`,
2026-09-18 schema-completeness pass) — declaratively real but NOT itself
engine-enforced yet ("attacked this turn" needs real per-turn
combat-history tracking `interfaces.ts`'s own `Player` has no method for,
Ward pattern — see `engine-support-registry.ts`'s own
`board-state-condition-not-enforced` entry), so the token creation still
fires every end step in practice, same as before this field existed; the
real gate is now at least structurally declared instead of silently
approximated as always-on.

X isn't a value anything in `EffectContext` computes live (no
turn-scoped life-gain tracker anywhere in state.ts) — supplied via
`triggerInput`, the same real convention hope-estheim's own "amount of
life you gained this turn" already establishes. "Target opponent"
approximates to every opponent (`owner: 'opponents'`) — same established
single-chosen-opponent simplification al-bhed-salvagers/combat-tutorial
already document.
