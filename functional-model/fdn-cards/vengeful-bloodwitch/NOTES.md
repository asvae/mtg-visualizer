# Vengeful Bloodwitch — authoring notes

## Authoring background

Real Forge: `Mode$ ChangesZone | ValidCard$ Card.Self,Creature.Other+YouCtrl
| Destination$ Graveyard` — "Whenever this creature or another creature
you control dies, target opponent loses 1 life and you gain 1 life." No
`on` value exists for a dies event; kept as a name-only trigger. "Target
opponent" approximates to every opponent (`owner: 'opponents'`) — same
established single-chosen-opponent simplification al-bhed-salvagers's own
near-identical "another creature you control dies" trigger already uses
(that exact card is the direct precedent for this shape).
