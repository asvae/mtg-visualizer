# Rite of the Dragoncaller — authoring notes

## Authoring background

Real Forge (rite_of_the_dragoncaller.txt): `T:Mode$ SpellCast | ValidCard$
Instant,Sorcery | ValidActivatingPlayer$ You | Execute$ TrigToken`. No
`Trigger.on` value exists for "you cast an instant or sorcery spell" (the
closed union only has `enter|upkeep|endStep|tapLandForMana|attacks|
equippedAttacks|otherPermanentEnters`) — kept as a bare name-only trigger,
the same long-established convention every other not-yet-auto-fired
trigger in this pool already uses (exemplar-of-light/courageous-goblin,
e.g.); not itself declared as a `missingSchemaFunctionality` gap.
