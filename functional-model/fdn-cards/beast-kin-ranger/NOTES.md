# Beast-Kin Ranger — authoring notes

## Authoring background

Real Forge (beast_kin_ranger.txt): `T:Mode$ ChangesZone | ValidCard$
Creature.Other+YouCtrl | Execute$ TrigPump` — "whenever another creature
you control enters." Kept as a bare name-only trigger, not
`on:'otherPermanentEnters'`: that shape's own `otherPermanentEntersMatch`
only supports a creature SUBTYPE filter, never a generic "must be a
Creature" type filter — using it unfiltered would incorrectly also match
a land/artifact/enchantment entering.
