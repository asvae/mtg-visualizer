# Billowing Shriekmass — authoring notes

## Authoring background

Real Threshold — the "7+ cards in graveyard" gate is now a real
`ContinuousGrantTargeting.condition`
(`BoardStateCondition.kind:'graveyardCountAtLeast'`, 2026-09-18
schema-completeness pass) — declaratively real but NOT itself
engine-enforced yet (`qualifiesForContinuousGrant` never checks it, Ward
pattern — see `engine-support-registry.ts`'s own
`board-state-condition-not-enforced` entry), so this grant still applies
unconditionally in practice, same as before this field existed; the real
gate is now at least structurally declared instead of silently
approximated as always-on.
