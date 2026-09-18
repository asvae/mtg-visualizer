# Infernal Vessel — authoring notes

## Authoring background

Real Forge: `Mode$ ChangesZone | Origin$ Battlefield | Destination$
Graveyard | ValidCard$ Card.Self+nonDemon`. The "if it wasn't a Demon"
gate (checking a real prior board-state fact) isn't tracked anywhere in
this engine — dropped as an accepted simplification (the rest of the
clause is real, executable code); no `on` value exists for a dies event
either, kept as a name-only trigger (same convention every other
not-yet-auto-fired trigger in this pool already uses).

"Return it to the battlefield" moves the SAME object (by the time this
trigger fires, `ctx.self` is already the card sitting in the graveyard) —
`actions.moveTo(ctx.self, 'Battlefield')`, the same real primitive
joshua-phoenix's-dominant's own exile-then-return custom effect already
uses. "It's a Demon in addition to its other types" is `actions.animate`
(real, additive — see interfaces.ts's own doc comment), not a full type
replacement.
