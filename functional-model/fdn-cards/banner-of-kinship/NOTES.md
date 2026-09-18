# Banner of Kinship — authoring notes

## Authoring background

Real Forge (banner_of_kinship.txt): `SVar:ChooseCT:DB$ ChooseType |
Defined$ You | Type$ Creature | ... | SubAbility$ DBCounters` — a
player-chosen creature TYPE, remembered for this permanent's own
lifetime, that both the ETB counter count AND the later continuous P/T
grant both key off (`Affected$ Creature.ChosenType+YouCtrl`). No
"remember a chosen creature type on this permanent, for later static
abilities to read" primitive exists anywhere in this schema — every
existing `subtype` filter (continuous grants, `putCounterAll`, etc.) is a
FIXED, authored string, never a runtime player choice.
