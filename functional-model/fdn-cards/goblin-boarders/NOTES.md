# Goblin Boarders — authoring notes

## Authoring background

"Raid — This creature enters with a +1/+1 counter on it if you attacked
this turn." The raid condition is now structurally declared via
`Trigger.condition: { kind: 'attackedThisTurn' }` (2026-09-18 schema-
completeness pass, same real `BoardStateCondition` gutless-plunderer's
own identical Raid clause already uses) — was previously a stale
omission (this trigger had no `condition` field at all, unconditionally
putting the counter on every ETB), fixed during the coverage-
justification authoring pass. Declaratively real but not yet
engine-enforced (Ward pattern — `resolveCard` has no live per-turn
attack-history tracking; see `engine-support-registry.ts`'s own
`board-state-condition-not-enforced` entry), same as every other
`BoardStateCondition` use pool-wide.
