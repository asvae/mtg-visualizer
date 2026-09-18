# High-Society Hunter — authoring notes

## Authoring background

Real Forge: `Mode$ Attacks | ValidCard$ Card.Self` — a real self-attack
auto-fire trigger. The sacrifice is a real COST on the put-counter
ability (`Cost$ Sac<1/Creature.Other/...>`) — same "optional sacrifice,
then the gated effect runs unconditionally" pattern namazu-trader's own
onAttack trigger already establishes (no player-decision engine exists to
model a DECLINED optional sacrifice separately).

Real Forge: `Mode$ ChangesZone | ValidCard$ Creature.!token+Other |
Origin$ Battlefield | Destination$ Graveyard` — "Whenever another
nontoken creature dies, draw a card." No `on` value exists for a dies
event; kept as a name-only trigger (same convention every other
not-yet-auto-fired trigger in this pool already uses).
