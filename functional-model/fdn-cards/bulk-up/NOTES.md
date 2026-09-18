# Bulk Up — authoring notes

## Authoring background

Real Flashback {4}{R}{R} — modeled the same way every other real
Flashback card in this pool does, via the shared `flashback()` factory
(`from: 'graveyard', thenExile: true` baked in), NOT as a `keywords`
entry (no such literal exists in the closed `Keyword` union).

"Double target creature's power until end of turn" needs the CHOSEN
target's own current power to compute the pump delta — `pumpTarget`'s
own `Computed<number>` fields only ever receive `EffectContext`, never
the target itself (the target is resolved internally, after
`power`/`toughness` would already need to be known) — real, narrow
reason this needs `custom` rather than the declarative `pumpTarget`
Effect. `actions.pump` (not `actions.pumpTarget`, which doesn't exist on
`Actions`) is the real primitive every other targeted-pump `custom`
effect in this pool already calls.
