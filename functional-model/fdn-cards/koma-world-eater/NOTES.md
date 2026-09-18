# Koma, World-Eater — authoring notes

## Authoring background

Real Forge (koma_world_eater.txt): `R:Event$ Counter | ValidCard$
Card.Self | ValidSA$ Spell | Layer$ CantHappen` — "this spell can't be
countered." No counterspell-prevention/protection mechanism exists
anywhere in this engine (there's no Stack-object counter-targeting model
at all — `kind:'counter'` is a log-only effect for the ACT of countering
something else, never a target-side immunity).
