# Twinflame Tyrant — authoring notes

## Authoring background

Real Forge (twinflame_tyrant.txt): `R:Event$ DamageDone | ValidSource$
Card.YouCtrl,Emblem.YouCtrl | ValidTarget$ Opponent,Permanent.OppCtrl |
ReplaceWith$ DmgTwice` — a real CR 614.2 damage-doubling replacement
scoped to damage YOU deal to an OPPONENT/their permanents. Distinct from
the existing `'LifegainDouble'`-style approximated replacement keywords
(which only ever double the CONTROLLER's own lifegain/coin-flip
outcomes) — no doubling-outgoing-damage replacement exists in this
engine's `Keyword` union at all.
