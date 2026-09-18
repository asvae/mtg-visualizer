# Tinybones, Bauble Burglar — authoring notes

## Authoring background

The onDiscard trigger's `custom` no-op: "Exile discarded card from
opponent graveyard with a stash counter" requires tracking discarded
cards and applying stash counters, which is beyond current vocabulary
representation.

Migrated from `staticAbilities` to `missingSchemaFunctionality`
(2026-09-18, FDN schema-tightness redesign).
