# Eager Trufflesnout — authoring notes

## Authoring background

Real Forge (eager_trufflesnout.txt): `T:Mode$ DamageDone | ValidSource$
Card.Self | ValidTarget$ Player | CombatDamage$ True` — "deals combat
damage to a player." No `Trigger.on` value exists for this dispatch;
kept as a bare name-only trigger (established convention). "Food" is a
real Scryfall keyword tag on this card, not a real Forge `K:` line/this
schema's `Keyword` — the actual token it creates is a plain noncreature
Artifact — Food token (its own sac-for-3-life ability is real, printed
token text; no P/T since it's not a Creature).
