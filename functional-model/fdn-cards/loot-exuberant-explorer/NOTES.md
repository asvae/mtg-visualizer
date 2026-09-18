# Loot, Exuberant Explorer — authoring notes

## Authoring background

Real Forge (loot_exuberant_explorer.txt): `S:Mode$ Continuous | Affected$
You | AdjustLandPlays$ 1` — an extra-land-drop static grant. No field
anywhere on `CardDefinition` tracks additional land plays per turn
(checked directly). `A:AB$ Dig | Cost$ 4 G G T | DigNum$ 6 | ChangeNum$ 1
| Optional$ True | ChangeValid$ Creature.cmcLEX | DestinationZone$
Battlefield | ...` — `kind:'dig'` only ever moves a matched card to HAND
or the bottom (see that Effect's own doc comment), never straight onto
the Battlefield, and has no dynamic mana-value threshold (`X` here is
live "number of lands you control," not a fixed number `dig`'s own
fields could carry).
