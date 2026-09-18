# Infestation Sage — authoring notes

## Authoring background

Real Forge: `Mode$ ChangesZone | Origin$ Battlefield | Destination$
Graveyard | ValidCard$ Card.Self` — "When this creature dies, create a
1/1 black and green Insect creature token with flying." No `on` value
exists for a dies event; kept as a name-only trigger. `TokenInfo` has no
`colors` field (see tokens.ts's own b_5_5_demon entry for the same,
already-documented "color isn't tracked anywhere in this model"
limitation) — the token's black-and-green color identity is real but
unrepresentable, only its real subtype/P&T/keyword survive.
