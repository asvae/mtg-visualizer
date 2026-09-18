# Skyship Buccaneer — authoring notes

## Authoring background

Raid mechanic requires checking if the player attacked this turn. This
requires turn-state tracking not yet modeled. Placeholder implementation
— would need real Raid mechanic support.

(Flagged during the 2026-09-18 comment-cleanup sweep: this card's own
trigger uses `condition: 'enters-battlefield'` and a `description` field
that don't match the `Trigger.on`/`name` shape every other card in this
pool uses — worth a schema-consistency check, out of scope for a
comment-relocation-only sweep.)
