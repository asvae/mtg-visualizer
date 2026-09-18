# Ashroot Animist — authoring notes

## Authoring background

Real Forge (ashroot_animist.txt): `T:Mode$ Attacks | ValidCard$
Card.Self` — real `on:'attacks'` dispatch. Two independent effects both
targeting "another target creature you control": `chooseTarget` is
documented as deterministically picking the first qualifying pool
candidate (no real player-decision engine), so both effects resolve
against the SAME creature by construction, not by coincidence.
