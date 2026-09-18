# Sphinx of Forgotten Lore — authoring notes

## Authoring background

Granting flashback to graveyard cards is not modeled. This would require
a new Effect kind or a complex custom implementation.

(Flagged during the 2026-09-18 comment-cleanup sweep: this card's own
trigger uses `condition: 'attacks'` and a `description` field that don't
match the `Trigger.on`/`name` shape every other card in this pool uses
— same shape mismatch as skyship-buccaneer — worth a schema-consistency
check, out of scope for a comment-relocation-only sweep.)
