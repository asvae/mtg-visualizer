# Tragic Banshee — authoring notes

## Authoring background

Real Forge (tragic_banshee.txt): `SVar:X:Count$Morbid.13.1` — Morbid ("if
a creature died this turn") is a real, live board-state condition with
NO tracking mechanism anywhere in this engine (grepped functional-model/
for "morbid": zero hits before this card; no `EffectContext` field like
`firstPhaseGroupOccurrenceThisTurn` exists for "did a creature die this
turn" either). GENUINE CAPACITY GAP, not a wrong-vocabulary mistake —
reclassified from the cheap tier's invented `hasMorbid` placeholder
boolean to a real, documented no-op. "Morbid" also isn't a `K:` line in
the real script (it's prose naming the trigger's own condition), so it
doesn't belong in `keywords` either.
