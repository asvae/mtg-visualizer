# Gorehorn Raider — authoring notes

## Authoring background

"Raid — When this creature enters, if you attacked this turn, this
creature deals 2 damage to any target." The raid condition is now
structurally declared via `Trigger.condition: { kind: 'attackedThisTurn'
}` (2026-09-18 schema-completeness pass, same real `BoardStateCondition`
gutless-plunderer's own identical Raid clause already uses) — was
previously a stale omission (unconditional ETB damage), fixed during the
coverage-justification authoring pass. Declaratively real but not yet
engine-enforced (Ward pattern — see `engine-support-registry.ts`'s own
`board-state-condition-not-enforced` entry), same as every other
`BoardStateCondition` use pool-wide.
