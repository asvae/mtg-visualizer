# Lunar Insight — authoring notes

## Authoring background

`Player` has no `getPermanentsInPlay` — the real generic accessor is
`getCardsIn(ZoneType)` (interfaces.ts's own `Player.getCardsIn`),
filtered to nonland.
