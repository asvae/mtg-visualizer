# Alesha, Who Laughs at Fate — authoring notes

## Authoring background

Real Forge (alesha_who_laughs_at_fate.txt): `T:Mode$ Attacks | ValidCard$
Card.Self` — "whenever Alesha attacks," real `on:'attacks'` dispatch
(`ValidCard$ Card.Self` scope, matches that value's own doc comment
exactly). The Raid return trigger's own firing shape (`Mode$ Phase |
Phase$ End of Turn | CheckSVar$ RaidTest`) is the real, now-modelable
Raid template (`on:'endStep'` + `condition:{kind:'attackedThisTurn'}`).
Its own EFFECT — "return target creature card with mana value <= NICKNAME's
power" — needs a live read of THIS permanent's own current power to
filter the graveyard pool, which no declarative `move.maxCmc` (a fixed
number, not `Computed`) can express; a narrowly-scoped `custom` closure
instead (genuinely functional, not a placeholder).
