# Mischievous Mystic — authoring notes

## Authoring background

Real Forge: `Mode$ Drawn | ValidCard$ Card.YouCtrl | Number$ 2` —
"Whenever you draw your second card each turn, create a 1/1 blue Faerie
creature token with flying." No `on` value exists for a "drew your Nth
card this turn" event — a real, already-documented gap (card.ts's own
`Trigger.on` doc comment: "no drawNthCardThisTurn on value exists
anywhere in this union"); kept as a name-only trigger, same convention
every other not-yet-auto-fired trigger in this pool already uses.
