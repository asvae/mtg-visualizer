# Fiery Annihilation — authoring notes

## Authoring background

Was flagged wholesale as a capacity gap; narrowed in the 2026-09-18
coverage-justification authoring pass. Two of the three originally-listed
gaps turned out to be real, already-available primitives, not gaps:
(1) Equipment-specific targeting IS representable — `getEquippedBy():
Card[]` (`interfaces.ts`, "for a creature, every Equipment currently
attached to it") is exactly the "Equipment.AttachedTo" query needed.
"Deals 5 damage to target creature" + "exile up to one target Equipment
attached to THAT creature" needs the SAME chosen target shared across
both clauses, so this is modeled as a single `custom` effect (same "one
shared local target variable" convention `felling-blow`'s own definition
already establishes), not two independent targeted `Effect`s.

(3) is subsumed by (1)'s single-`custom`-effect structure — no separate
"conditional cascading" primitive was needed once both halves share one
`run` closure.

(2), the actual genuine capacity gap: "If that creature would die this
turn, exile it instead" is a real CR 614.2 death-REPLACEMENT effect
(intercepting the creature's own eventual graveyard-bound zone change and
redirecting it to Exile, for the rest of the turn) — `state.ts` has
narrow per-keyword replacement hooks for damage/lifegain/untap
(`DamagePrevention`/`CombatDamagePrevention`/`LifegainDouble`/
`CantUntap`) but nothing intercepts the death/zone-change event itself.
Declared as a real `missingSchemaFunctionality` entry — caps this card
at `purple`.
