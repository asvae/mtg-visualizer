# Kykar, Zephyr Awakener — authoring notes

## Authoring background

Real Forge (kykar_zephyr_awakener.txt): `T:Mode$ SpellCast | ValidCard$
Card.nonCreature` — bare name-only trigger (no `on` value exists for
"you cast a noncreature spell"). Mode 1's own `SVar:DelTrig:DB$
DelayedTrigger | Mode$ Phase | Phase$ End of Turn | ...` is a real,
genuine DELAYED trigger (exile now, come back at a LATER game event) — no
`ProgramNode`/Effect primitive schedules a future trigger at all (this
engine's own `ENGINE_GAPS.md`-tracked "delayed trigger" gap, distinct
from a plain `untilEndOfTurn` duration flag).
