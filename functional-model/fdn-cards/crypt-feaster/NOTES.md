# Crypt Feaster — authoring notes

## Authoring background

Real Forge: `Mode$ Attacks | ValidCard$ Card.Self` — a real self-attack
auto-fire trigger, `on: 'attacks'`. The Threshold condition itself (7+
cards in graveyard) is now a real `Trigger.condition`
(`BoardStateCondition.kind:'graveyardCountAtLeast'`, 2026-09-18
schema-completeness pass) — declaratively real but NOT itself
engine-enforced yet (`resolveCard` has no live `GameState` to check it
against, Ward pattern — see `engine-support-registry.ts`'s own
`board-state-condition-not-enforced` entry), so the pump still applies
every attack in practice, same as before this field existed; the real
gate is now at least structurally declared instead of silently
approximated as always-on.
