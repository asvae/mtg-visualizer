# Searslicer Goblin — authoring notes

## Authoring background

Real Forge (searslicer_goblin.txt): `T:Mode$ Phase | Phase$ End of Turn |
ValidPlayer$ You | CheckSVar$ RaidTest | ... | SVar:RaidTest:
Count$AttackersDeclared` — the real, now-modelable Raid template
(`Trigger.on:'endStep'` + `condition:{kind:'attackedThisTurn'}`,
2026-09-18 schema-completeness pass).
