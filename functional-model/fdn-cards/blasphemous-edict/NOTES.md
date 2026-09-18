# Blasphemous Edict — authoring notes

## Authoring background

Real Forge: `S:Mode$ AlternativeCost | Cost$ B | IsPresent$ Creature |
PresentCompare$ GE13`. A board-state-CONDITIONAL alternate cost —
genuinely different from `AlternateCost` (that shape is fixed to `from:
'graveyard'|'exile'`, real Flashback/Jump-start territory; this is a
same-zone (hand) cost SWAP gated on a creature-count threshold). No such
conditional-cost vocabulary exists anywhere in this engine. Migrated from
`staticAbilities` to `missingSchemaFunctionality` (2026-09-18, FDN
schema-tightness redesign).
