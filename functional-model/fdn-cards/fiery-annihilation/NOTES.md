# Fiery Annihilation — authoring notes

## Authoring background

FLAG: Conditional exile and death-replacement mechanics (capacity gap)
Real card ability: Fiery Annihilation deals 5 damage to target creature.
Exile up to one target Equipment attached to that creature.
If that creature would die this turn, exile it instead.

Missing infrastructure:
(1) Equipment-specific targeting (Equipment.AttachedTo predicate)
(2) Death-replacement mechanics (ReplaceDyingDefined$)
(3) Conditional cascading (if creature would die, exile instead of normal death)
