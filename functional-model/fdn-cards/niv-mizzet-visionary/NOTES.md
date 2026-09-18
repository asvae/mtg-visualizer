# Niv-Mizzet, Visionary — authoring notes

## Authoring background

Real Forge (niv_mizzet_visionary.txt): `S:Mode$ Continuous | Affected$
You | SetMaxHandSize$ Unlimited` — no hand-size tracking/enforcement
exists anywhere in this engine (no CR 502.4 cleanup discard-to-hand-size
step, no field for overriding max hand size). The draw trigger reads its
own dynamic magnitude off `ctx.triggerInput` (a scenario-supplied
per-trigger fact, same established convention `hope-estheim`'s own
`lifeGainedThisTurn` key already uses).
