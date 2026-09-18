# Crystal Barricade — authoring notes

## Authoring background

"You have hexproof." / "Prevent all noncombat damage that would be dealt
to other creatures you control." Both of these are static
replacement-effect rules that the engine doesn't yet model. Hexproof on
the player requires a player-level static grant (no such mechanism
exists). Noncombat damage prevention is a CR 614.2 replacement effect
(ENGINE_GAPS.md gap #8). Migrated from `staticAbilities` to
`missingSchemaFunctionality` (2026-09-18, FDN schema-tightness redesign)
— same real, unmodeled gaps, now declared via the structured field
instead of free text.
